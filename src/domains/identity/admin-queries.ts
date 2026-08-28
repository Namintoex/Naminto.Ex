import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/domains/event-bus";
import { logSecurityEvent } from "./security-events";
import type { Database, KycStatus } from "@/lib/supabase/database.types";

type IdentityProfileRow = Database["public"]["Tables"]["identity_profiles"]["Row"];
type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
type SecurityEventRow = Database["public"]["Tables"]["security_events"]["Row"];

const PAGE_SIZE = 25;

export interface AdminListUsersFilters {
  search?: string;
  kycStatus?: KycStatus;
}

export interface AdminListUsersResult {
  users: IdentityProfileRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Back Office — Users/KYC (Prompt 22). `identity_profiles` n'a qu'une
 * policy RLS restreinte au titulaire (0001_identity.sql) : toute lecture
 * cross-utilisateurs passe nécessairement par service_role. Aucune règle
 * métier réimplémentée ici — un simple filtre/tri sur les colonnes déjà
 * définies au Prompt 04/05.
 */
export async function adminListUsers(
  filters: AdminListUsersFilters = {},
  page = 1
): Promise<AdminListUsersResult> {
  const admin = createAdminClient();
  let query = admin.from("identity_profiles").select("*", { count: "exact" });

  if (filters.search) {
    // `.or()` parse sa chaîne comme une expression du mini-langage de
    // filtre PostgREST (contrairement à `.eq()`/`.ilike()` — Prompt 28,
    // ADR-056) : virgule/point/parenthèse y sont des caractères
    // réservés (séparateur de clause, structure column.op.value,
    // groupement). PostgREST neutralise ces caractères dans une valeur
    // en l'entourant de guillemets doubles — jamais par un antislash nu
    // devant chaque caractère, qui finit littéralement dans la valeur
    // comparée et casse une recherche pourtant légitime. Seuls le
    // guillemet double et l'antislash doivent être échappés à
    // l'intérieur de la valeur ainsi entre guillemets.
    const term = filters.search.trim().replace(/[\\"]/g, "\\$&");
    query = query.or(`naminto_id.ilike."%${term}%",legal_name.ilike."%${term}%"`);
  }
  if (filters.kycStatus) {
    query = query.eq("kyc_status", filters.kycStatus);
  }

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  return { users: data ?? [], total: count ?? 0, page: safePage, pageSize: PAGE_SIZE };
}

/**
 * Formes volontairement restreintes (Prompt 28, ADR-056) : la fiche
 * utilisateur n'affiche jamais que plateforme/statut par appareil et
 * type/date par événement, mais `select("*")` envoyait quand même
 * `device_fingerprint`, `ip_hash` et le `metadata` brut de chaque
 * événement (transitions KYC, raisons de blocage…) au navigateur de
 * tout admin ayant `user.read` (support, kyc, compliance, security) —
 * une audience bien plus large que celle qui a réellement besoin de ces
 * détails de forensic (le rôle `security`, via /admin/audit).
 */
export interface AdminUserDeviceSummary {
  id: string;
  platform: string | null;
  status: DeviceRow["status"];
}
export interface AdminUserSecurityEventSummary {
  id: string;
  type: SecurityEventRow["type"];
  created_at: string;
}

export interface AdminUserDetail {
  profile: IdentityProfileRow;
  email: string | null;
  devices: AdminUserDeviceSummary[];
  securityEvents: AdminUserSecurityEventSummary[];
}

export async function adminGetUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const admin = createAdminClient();

  const { data: profile } = await admin.from("identity_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!profile) return null;

  const [{ data: authUser }, { data: devices }, { data: securityEvents }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("devices").select("id, platform, status").eq("user_id", userId).order("last_seen_at", { ascending: false }),
    admin
      .from("security_events")
      .select("id, type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    profile,
    email: authUser?.user?.email ?? null,
    devices: devices ?? [],
    securityEvents: securityEvents ?? [],
  };
}

export type AdminUpdateKycStatusResult = { ok: true } | { ok: false; error: string };

/**
 * Back Office — KYC (Prompt 22). Première voie réelle de changement de
 * `kyc_status` dans ce dépôt (jusqu'ici jamais modifié après
 * l'inscription — voir docs/DECISIONS.md). Ne réimplémente aucune
 * logique de vérification d'identité : une simple transition d'état,
 * journalisée. Aucune source ne documente de state machine KYC
 * spécifique (à la différence de TransactionStatus, Prompt 08) — plutôt
 * que d'en inventer une, seul un changement réel (next ≠ actuel) est
 * exigé ; une state machine KYC réelle est un TODO_DECISION probablement
 * lié à l'intégration d'un fournisseur KYC externe (déjà noté comme
 * TODO_DECISION User). Séparée de admin-actions.ts ("use server") pour
 * rester testable directement (revalidatePath ne s'exécute pas hors du
 * runtime Next.js).
 */
export async function adminUpdateKycStatus(userId: string, next: KycStatus): Promise<AdminUpdateKycStatusResult> {
  const admin = createAdminClient();

  const { data: profile } = await admin.from("identity_profiles").select("kyc_status").eq("user_id", userId).maybeSingle();
  if (!profile) return { ok: false, error: "admin.users.error.notFound" };

  if (profile.kyc_status === next) {
    return { ok: false, error: "admin.kyc.error.invalidTransition" };
  }

  const { error } = await admin.from("identity_profiles").update({ kyc_status: next }).eq("user_id", userId);
  if (error) return { ok: false, error: "admin.kyc.error.updateFailed" };

  await logSecurityEvent({
    userId,
    type: "kyc_status_changed",
    metadata: { from: profile.kyc_status, to: next },
  });
  await publishEvent("KYCStatusChanged", { from: profile.kyc_status, to: next }, userId);

  return { ok: true };
}

export type AdminSetUserSuspendedResult = { ok: true } | { ok: false; error: string };

/**
 * Back Office — Users (Prompt 23, permission `user.suspend` explicitement
 * nommée dans le prompt). `identity_profiles.status` connaît déjà
 * `suspended` depuis le Prompt 04 (jamais utilisé jusqu'ici, faute
 * d'action pour l'atteindre). Ne touche jamais `active`/`closed` — un
 * compte `pending_verification` suspendu revient à `active`, pas à son
 * état d'origine, choix simple assumé (aucune source ne documente de
 * nuance ici).
 */
export async function adminSetUserSuspended(userId: string, suspended: boolean): Promise<AdminSetUserSuspendedResult> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("identity_profiles").select("status").eq("user_id", userId).maybeSingle();
  if (!profile) return { ok: false, error: "admin.users.error.notFound" };

  const next = suspended ? "suspended" : "active";
  if (profile.status === next) {
    return { ok: false, error: "admin.users.error.alreadyInStatus" };
  }

  const { error } = await admin.from("identity_profiles").update({ status: next }).eq("user_id", userId);
  if (error) return { ok: false, error: "admin.users.error.updateFailed" };

  await logSecurityEvent({
    userId,
    type: "user_status_changed",
    metadata: { from: profile.status, to: next },
  });

  return { ok: true };
}
