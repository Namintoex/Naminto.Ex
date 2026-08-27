import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type FeeRuleRow = Database["public"]["Tables"]["fee_rules"]["Row"];
type FeeRuleInsert = Database["public"]["Tables"]["fee_rules"]["Insert"];

/**
 * Back Office — Pricing (Prompt 22). CRUD direct sur `fee_rules` :
 * aucune règle de calcul ici (`calculate-fee.ts` reste la seule source
 * de vérité pour appliquer une règle) — seulement lister/créer/activer.
 */
export async function adminListFeeRules(): Promise<FeeRuleRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("fee_rules").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function adminCreateFeeRule(input: FeeRuleInsert): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("fee_rules").insert(input).select("id").single();
  if (error || !data) return { error: error?.message ?? "insert_failed" };
  return { id: data.id };
}

export async function adminSetFeeRuleActive(id: string, active: boolean): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("fee_rules").update({ active }).eq("id", id);
  return !error;
}
