import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getIdentityProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("identity_profiles")
    .select("naminto_id, legal_name, status")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getDevices(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select("id, device_fingerprint, platform, status, trusted, first_seen_at, last_seen_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  return data ?? [];
}

export async function getSecurityEvents(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("security_events")
    .select("id, type, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface RecipientLookup {
  userId: string;
  namintoId: string;
  legalName: string;
}

/**
 * Résout un bénéficiaire Naminto.Ex par son identifiant public — utilisé
 * par Send Money (Prompt 13) pour l'étape « Vérification » du
 * bénéficiaire. `identity_profiles` n'a qu'une policy RLS restreinte au
 * titulaire (migration 0001) : cette résolution passe donc par
 * `service_role`, et ne renvoie jamais que le strict minimum nécessaire
 * à la confirmation d'un envoi (jamais le téléphone, le statut KYC, etc.).
 */
export async function findRecipientByNamintoId(namintoId: string): Promise<RecipientLookup | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("identity_profiles")
    .select("user_id, naminto_id, legal_name")
    .eq("naminto_id", namintoId.trim().toLowerCase())
    .maybeSingle();
  if (!data) return null;
  return { userId: data.user_id, namintoId: data.naminto_id, legalName: data.legal_name };
}

/**
 * La table pin_credentials n'a aucune policy SELECT (voir migration
 * 0001_identity.sql) — même le titulaire ne peut pas lire son propre hash.
 * Cette vérification d'existence passe donc par le client service_role.
 */
export async function hasPinSet(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pin_credentials")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}
