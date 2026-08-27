import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type ComplianceRuleRow = Database["public"]["Tables"]["compliance_rules"]["Row"];
type ComplianceRuleInsert = Database["public"]["Tables"]["compliance_rules"]["Insert"];

/** Back Office — Pricing/Compliance (Prompt 22). CRUD direct sur `compliance_rules` — aucune logique de décision réimplémentée (determine-requirement.ts reste la seule source de vérité). */
export async function adminListComplianceRules(): Promise<ComplianceRuleRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("compliance_rules").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function adminCreateComplianceRule(
  input: ComplianceRuleInsert
): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("compliance_rules").insert(input).select("id").single();
  if (error || !data) return { error: error?.message ?? "insert_failed" };
  return { id: data.id };
}

export async function adminSetComplianceRuleActive(id: string, active: boolean): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("compliance_rules").update({ active }).eq("id", id);
  return !error;
}
