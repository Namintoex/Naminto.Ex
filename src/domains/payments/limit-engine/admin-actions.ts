"use server";

import { revalidatePath } from "next/cache";
import { adminCreateLimitRule, adminSetLimitRuleActive } from "./admin-queries";
import type { Database } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function adminCreateLimitRuleAction(
  input: Database["public"]["Tables"]["limit_rules"]["Insert"]
): Promise<AdminActionResult> {
  const result = await adminCreateLimitRule(input);
  if ("error" in result) return { ok: false, error: "admin.pricing.error.createFailed" };
  revalidatePath("/admin/pricing");
  return { ok: true };
}

export async function adminSetLimitRuleActiveAction(id: string, active: boolean): Promise<AdminActionResult> {
  const ok = await adminSetLimitRuleActive(id, active);
  if (!ok) return { ok: false, error: "admin.pricing.error.createFailed" };
  revalidatePath("/admin/pricing");
  return { ok: true };
}
