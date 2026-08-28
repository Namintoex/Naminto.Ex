import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { permissionsForRoles, type AdminRole, type Permission } from "./types";

/**
 * Bootstrap RBAC (Prompt 23) : tant qu'aucune ligne n'existe dans
 * `admin_role_assignments` (projet fraîchement migré), le tout premier
 * utilisateur authentifié qui accède à /admin s'auto-attribue
 * `super_admin` — il n'existe sinon aucun moyen d'amorcer le système
 * (aucune source ne désigne un compte précis comme premier
 * administrateur). Une fois cette première ligne posée, plus aucun
 * bootstrap n'a lieu : seul un super_admin peut ensuite attribuer des
 * rôles (écran /admin/roles). Voir docs/DECISIONS.md ADR-051.
 *
 * `bootstrap_super_admin` (RPC, migration 0020) rend le SELECT count()=0
 * + INSERT atomiques via un verrou consultatif transactionnel — sans
 * cela, deux comptes distincts accédant à /admin au même instant sur un
 * projet vide pouvaient tous deux devenir super_admin (Prompt 28,
 * ADR-056).
 */
export async function getUserRoles(userId: string): Promise<AdminRole[]> {
  const admin = createAdminClient();

  const { data: ownRoles } = await admin.from("admin_role_assignments").select("role").eq("user_id", userId);
  if (ownRoles && ownRoles.length > 0) {
    return ownRoles.map((r) => r.role);
  }

  const { data: bootstrapped } = await admin.rpc("bootstrap_super_admin", { p_user_id: userId });
  if (bootstrapped) {
    return ["super_admin"];
  }

  return [];
}

export async function getUserPermissions(userId: string): Promise<Set<Permission>> {
  const roles = await getUserRoles(userId);
  return permissionsForRoles(roles);
}

export async function userHasPermission(userId: string, permission: Permission): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.has(permission);
}

export interface AdminRoleAssignmentRow {
  namintoId: string;
  legalName: string;
  userId: string;
  roles: AdminRole[];
}

/** Back Office — Roles (Prompt 23). Liste uniquement les comptes ayant au moins un rôle — jamais les 128+ clients ordinaires. */
export async function adminListRoleAssignments(): Promise<AdminRoleAssignmentRow[]> {
  const admin = createAdminClient();
  const { data: assignments } = await admin.from("admin_role_assignments").select("user_id, role").order("user_id");
  if (!assignments || assignments.length === 0) return [];

  const userIds = [...new Set(assignments.map((a) => a.user_id))];
  const { data: profiles } = await admin
    .from("identity_profiles")
    .select("user_id, naminto_id, legal_name")
    .in("user_id", userIds);
  const profileByUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const rolesByUser = new Map<string, AdminRole[]>();
  for (const a of assignments) {
    const list = rolesByUser.get(a.user_id) ?? [];
    list.push(a.role);
    rolesByUser.set(a.user_id, list);
  }

  return userIds.map((userId) => {
    const profile = profileByUser.get(userId);
    return {
      userId,
      namintoId: profile?.naminto_id ?? "—",
      legalName: profile?.legal_name ?? "—",
      roles: rolesByUser.get(userId) ?? [],
    };
  });
}
