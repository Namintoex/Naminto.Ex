"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/domains/rbac";
import {
  adminSetUserSuspended,
  adminUpdateKycStatus,
  type AdminSetUserSuspendedResult,
  type AdminUpdateKycStatusResult,
} from "./admin-queries";
import type { KycStatus } from "@/lib/supabase/database.types";

/**
 * Wrapper "use server" fin autour de `adminUpdateKycStatus`
 * (admin-queries.ts) : la logique de transition/journalisation vit là,
 * testable directement — ici, le contrôle de permission (Prompt 23,
 * `kyc.review`) puis le revalidate propre à Next.js.
 */
export async function adminUpdateKycStatusAction(userId: string, next: KycStatus): Promise<AdminUpdateKycStatusResult> {
  const auth = await checkPermission("kyc.review");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminUpdateKycStatus(userId, next);
  if (result.ok) {
    revalidatePath("/admin/kyc");
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
  }
  return result;
}

export async function adminSetUserSuspendedAction(userId: string, suspended: boolean): Promise<AdminSetUserSuspendedResult> {
  const auth = await checkPermission("user.suspend");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminSetUserSuspended(userId, suspended);
  if (result.ok) {
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
  }
  return result;
}
