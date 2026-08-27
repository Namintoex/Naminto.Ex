"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPermission } from "./guard";
import { adminAssignRole, adminRevokeRole, type AdminActionResult } from "./admin-mutations";
import type { AdminRole } from "./types";

export type { AdminActionResult };

export async function adminAssignRoleByNamintoIdAction(namintoId: string, role: AdminRole): Promise<AdminActionResult> {
  const auth = await checkPermission("role.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("identity_profiles")
    .select("user_id")
    .eq("naminto_id", namintoId.trim())
    .maybeSingle();
  if (!profile) return { ok: false, error: "admin.roles.error.userNotFound" };

  const result = await adminAssignRole(profile.user_id, role, auth.userId);
  if (result.ok) revalidatePath("/admin/roles");
  return result;
}

export async function adminRevokeRoleAction(targetUserId: string, role: AdminRole): Promise<AdminActionResult> {
  const auth = await checkPermission("role.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminRevokeRole(targetUserId, role, auth.userId);
  if (result.ok) revalidatePath("/admin/roles");
  return result;
}
