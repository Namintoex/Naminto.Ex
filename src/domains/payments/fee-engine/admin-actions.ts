"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/domains/rbac";
import { adminCreateFeeRule, adminSetFeeRuleActive } from "./admin-queries";
import type { Database } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function adminCreateFeeRuleAction(
  input: Database["public"]["Tables"]["fee_rules"]["Insert"]
): Promise<AdminActionResult> {
  const auth = await checkPermission("pricing.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminCreateFeeRule(input);
  if ("error" in result) return { ok: false, error: "admin.pricing.error.createFailed" };
  revalidatePath("/admin/pricing");
  return { ok: true };
}

export async function adminSetFeeRuleActiveAction(id: string, active: boolean): Promise<AdminActionResult> {
  const auth = await checkPermission("pricing.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const ok = await adminSetFeeRuleActive(id, active);
  if (!ok) return { ok: false, error: "admin.pricing.error.createFailed" };
  revalidatePath("/admin/pricing");
  return { ok: true };
}
