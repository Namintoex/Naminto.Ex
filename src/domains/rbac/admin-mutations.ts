import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/domains/identity/security-events";
import type { AdminRole } from "./types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function adminAssignRole(targetUserId: string, role: AdminRole, actorUserId: string): Promise<AdminActionResult> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_role_assignments").insert({ user_id: targetUserId, role });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "admin.roles.error.alreadyAssigned" };
    return { ok: false, error: "admin.roles.error.updateFailed" };
  }

  await logSecurityEvent({
    userId: targetUserId,
    type: "admin_role_changed",
    metadata: { action: "assigned", role, actorUserId },
  });

  return { ok: true };
}

export async function adminRevokeRole(targetUserId: string, role: AdminRole, actorUserId: string): Promise<AdminActionResult> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_role_assignments").delete().eq("user_id", targetUserId).eq("role", role);
  if (error) return { ok: false, error: "admin.roles.error.updateFailed" };

  await logSecurityEvent({
    userId: targetUserId,
    type: "admin_role_changed",
    metadata: { action: "revoked", role, actorUserId },
  });

  return { ok: true };
}
