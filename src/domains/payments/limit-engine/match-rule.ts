import type { Database, LimitType } from "@/lib/supabase/database.types";
import { pickMostSpecific } from "../shared/pick-most-specific";
import type { LimitCheckInput } from "./types";

export type LimitRule = Database["public"]["Tables"]["limit_rules"]["Row"];

/**
 * Mêmes règles de correspondance que fee_rules (Prompt 10) : un champ
 * NULL sur la règle est un joker.
 */
export function ruleMatches(rule: LimitRule, input: LimitCheckInput): boolean {
  if (rule.currency !== null && rule.currency !== input.currency) return false;
  if (rule.country !== null && rule.country !== (input.country ?? null)) return false;
  if (rule.kyc_status !== null && rule.kyc_status !== (input.kycStatus ?? null)) return false;
  if (rule.provider !== null && rule.provider !== (input.provider ?? null)) return false;
  if (rule.transaction_type !== null && rule.transaction_type !== (input.transactionType ?? null)) return false;
  if (rule.user_tier !== null && rule.user_tier !== (input.userTier ?? null)) return false;
  return true;
}

export function ruleSpecificity(rule: LimitRule): number {
  const dimensions = [
    rule.country,
    rule.currency,
    rule.kyc_status,
    rule.provider,
    rule.transaction_type,
    rule.user_tier,
  ];
  return dimensions.filter((d) => d !== null).length;
}

/**
 * Retient, pour un type de limite donné, la règle active la plus
 * spécifique qui correspond — ou `null` si aucune n'est configurée
 * (absence de règle = absence de contrainte, jamais un refus).
 */
export function pickRuleForType(
  rules: LimitRule[],
  limitType: LimitType,
  input: LimitCheckInput
): LimitRule | null {
  return pickMostSpecific(
    rules,
    (rule) => rule.active && rule.limit_type === limitType && ruleMatches(rule, input),
    ruleSpecificity
  );
}
