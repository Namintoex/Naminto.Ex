import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickMostSpecificRule } from "./match-rule";
import { NoMatchingFeeRuleError, type FeeCalculationInput, type FeeCalculationResult } from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Fee Engine (Prompt 10). Domaine indépendant, entièrement piloté par la
 * configuration en base (`fee_rules`) — aucune règle tarifaire n'est
 * codée en dur ici ni dans l'UI. Retient la règle active la plus
 * spécifique qui correspond à la requête (voir match-rule.ts).
 */
export async function calculateFee(input: FeeCalculationInput): Promise<FeeCalculationResult> {
  const admin = createAdminClient();
  // `.order("created_at")` (revue de code) : sans ordre explicite,
  // PostgREST/Postgres ne garantit aucun ordre de ligne — le
  // départage à égalité de spécificité de `pickMostSpecific` (« la
  // première du tableau l'emporte ») dépendait alors de l'ordre
  // physique en base, pas d'un critère prévisible. La plus ancienne
  // règle à égalité l'emporte désormais, de façon stable et auditable.
  const { data: rules, error } = await admin.from("fee_rules").select("*").eq("active", true).order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Fee Engine: lecture des règles échouée (${error.message})`);
  }

  const rule = pickMostSpecificRule(rules ?? [], input);
  if (!rule) {
    throw new NoMatchingFeeRuleError(input);
  }

  const fee = round2(input.amount * rule.rate_percent + rule.flat_fee);
  const feePayer = input.feePayerOverride ?? rule.fee_payer;

  return {
    fee,
    senderDebit: feePayer === "sender" ? round2(input.amount + fee) : input.amount,
    recipientCredit: feePayer === "recipient" ? round2(input.amount - fee) : input.amount,
    feePayer,
    ruleId: rule.id,
  };
}
