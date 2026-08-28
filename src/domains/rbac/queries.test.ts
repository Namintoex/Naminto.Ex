import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPermissions, getUserRoles, userHasPermission } from "./queries";

/**
 * Test d'intégration contre le vrai projet Supabase. Le bootstrap
 * « premier accès = super_admin automatique » (queries.ts) ne s'exécute
 * que sur une table `admin_role_assignments` complètement vide — un état
 * global, atteint une seule fois dans la vie du projet et déjà consommé
 * (vérifié manuellement dans le navigateur, voir docs/DECISIONS.md
 * ADR-051). Le vider pour le retester ici serait destructif sur le
 * projet réel partagé : ce test vérifie donc la branche la plus critique
 * pour la sécurité — qu'un utilisateur SANS rôle ne reçoit RIEN
 * (jamais de repli implicite) une fois que la table n'est plus vide —
 * et laisse le chemin de bootstrap lui-même à la vérification manuelle.
 */
describe("RBAC — getUserRoles / getUserPermissions (intégration)", () => {
  const admin = createAdminClient();
  let assignedUserId: string;
  let unassignedUserId: string;
  const assignedEmail = `vitest-rbac-assigned-${randomUUID()}@example.test`;
  const unassignedEmail = `vitest-rbac-unassigned-${randomUUID()}@example.test`;

  afterAll(async () => {
    if (assignedUserId) await admin.auth.admin.deleteUser(assignedUserId);
    if (unassignedUserId) await admin.auth.admin.deleteUser(unassignedUserId);
  });

  it("renvoie les rôles explicitement attribués à un utilisateur", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: assignedEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_rbac_a_${randomUUID().slice(0, 8)}`, legal_name: "Vitest RBAC Assigned" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    assignedUserId = data.user.id;

    await admin.from("admin_role_assignments").insert([
      { user_id: assignedUserId, role: "kyc" },
      { user_id: assignedUserId, role: "risk" },
    ]);

    const roles = await getUserRoles(assignedUserId);
    expect(new Set(roles)).toEqual(new Set(["kyc", "risk"]));

    const permissions = await getUserPermissions(assignedUserId);
    expect(permissions.has("kyc.review")).toBe(true);
    expect(permissions.has("risk.read")).toBe(true);
    expect(permissions.has("role.manage")).toBe(false);

    expect(await userHasPermission(assignedUserId, "kyc.review")).toBe(true);
    expect(await userHasPermission(assignedUserId, "role.manage")).toBe(false);
  });

  it("un utilisateur sans rôle ne reçoit jamais de repli implicite (table déjà non vide)", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: unassignedEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_rbac_u_${randomUUID().slice(0, 8)}`, legal_name: "Vitest RBAC Unassigned" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    unassignedUserId = data.user.id;

    // La table contient déjà au moins la ligne du test précédent :
    // jamais de bootstrap ici, quel que soit l'ordre d'exécution.
    const roles = await getUserRoles(unassignedUserId);
    expect(roles).toEqual([]);

    const permissions = await getUserPermissions(unassignedUserId);
    expect(permissions.size).toBe(0);
    expect(await userHasPermission(unassignedUserId, "dashboard.read")).toBe(false);
  });

  it("bootstrap_super_admin (RPC) reste sûr sous appels concurrents une fois la table non vide (Prompt 28, ADR-056)", async () => {
    // La table contient déjà des lignes réelles à ce stade du projet —
    // vérifie que deux appels concurrents à la fonction de bootstrap
    // elle-même (pas seulement getUserRoles) refusent tous les deux,
    // jamais un repli accordé par accident de course.
    const fakeUserIdA = randomUUID();
    const fakeUserIdB = randomUUID();

    const [resultA, resultB] = await Promise.all([
      admin.rpc("bootstrap_super_admin", { p_user_id: fakeUserIdA }),
      admin.rpc("bootstrap_super_admin", { p_user_id: fakeUserIdB }),
    ]);

    expect(resultA.data).toBe(false);
    expect(resultB.data).toBe(false);

    const { count } = await admin
      .from("admin_role_assignments")
      .select("user_id", { count: "exact", head: true })
      .in("user_id", [fakeUserIdA, fakeUserIdB]);
    expect(count).toBe(0);
  });
});
