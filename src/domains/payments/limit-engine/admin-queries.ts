import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type LimitRuleRow = Database["public"]["Tables"]["limit_rules"]["Row"];
type LimitRuleInsert = Database["public"]["Tables"]["limit_rules"]["Insert"];

/** Back Office — Pricing/Limits (Prompt 22). CRUD direct sur `limit_rules` — aucune logique de vérification réimplémentée (check-limits.ts reste la seule source de vérité). */
export async function adminListLimitRules(): Promise<LimitRuleRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("limit_rules").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function adminCreateLimitRule(input: LimitRuleInsert): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("limit_rules").insert(input).select("id").single();
  if (error || !data) return { error: error?.message ?? "insert_failed" };
  return { id: data.id };
}

export async function adminSetLimitRuleActive(id: string, active: boolean): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("limit_rules").update({ active }).eq("id", id);
  return !error;
}
