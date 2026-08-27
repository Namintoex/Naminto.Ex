import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminAssignRole, adminRevokeRole } from "./admin-mutations";

describe("RBAC — adminAssignRole / adminRevokeRole (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const testEmail = `vitest-rbac-mutations-${randomUUID()}@example.test`;
  const actorUserId = randomUUID(); // acteur fictif, jamais un vrai compte requis pour ce test

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("attribue un rôle, journalise l'événement, refuse un doublon, puis retire le rôle", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_rbac_m_${randomUUID().slice(0, 8)}`, legal_name: "Vitest RBAC Mutations" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    userId = data.user.id;

    const assigned = await adminAssignRole(userId, "operations", actorUserId);
    expect(assigned).toEqual({ ok: true });

    const { data: row } = await admin
      .from("admin_role_assignments")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operations")
      .maybeSingle();
    expect(row).toBeTruthy();

    const { data: events } = await admin
      .from("security_events")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "admin_role_changed");
    expect(events).toHaveLength(1);
    expect(events![0].metadata).toMatchObject({ action: "assigned", role: "operations" });

    const duplicate = await adminAssignRole(userId, "operations", actorUserId);
    expect(duplicate).toEqual({ ok: false, error: "admin.roles.error.alreadyAssigned" });

    const revoked = await adminRevokeRole(userId, "operations", actorUserId);
    expect(revoked).toEqual({ ok: true });

    const { data: rowAfter } = await admin
      .from("admin_role_assignments")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operations")
      .maybeSingle();
    expect(rowAfter).toBeNull();

    const { data: eventsAfter } = await admin
      .from("security_events")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "admin_role_changed");
    expect(eventsAfter).toHaveLength(2);
  });
});
