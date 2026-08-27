"use server";

import { revalidatePath } from "next/cache";
import { adminCreateComplianceRule, adminSetComplianceRuleActive } from "./admin-queries";
import type { Database } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function adminCreateComplianceRuleAction(
  input: Database["public"]["Tables"]["compliance_rules"]["Insert"]
): Promise<AdminActionResult> {
  const result = await adminCreateComplianceRule(input);
  if ("error" in result) return { ok: false, error: "admin.pricing.error.createFailed" };
  revalidatePath("/admin/pricing");
  return { ok: true };
}

export async function adminSetComplianceRuleActiveAction(id: string, active: boolean): Promise<AdminActionResult> {
  const ok = await adminSetComplianceRuleActive(id, active);
  if (!ok) return { ok: false, error: "admin.pricing.error.createFailed" };
  revalidatePath("/admin/pricing");
  return { ok: true };
}
