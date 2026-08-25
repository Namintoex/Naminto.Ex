import type { Database } from "@/lib/supabase/database.types";
import { pickMostSpecific } from "../shared/pick-most-specific";
import type { FeeCalculationInput } from "./types";

export type FeeRule = Database["public"]["Tables"]["fee_rules"]["Row"];

/**
 * Une règle correspond si, pour chaque dimension qu'elle contraint
 * (valeur non NULL), la requête a exactement cette valeur. Un champ NULL
 * sur la règle est un joker : il correspond à n'importe quelle valeur,
 * y compris une requête qui ne renseigne pas cette dimension.
 */
export function ruleMatches(rule: FeeRule, input: FeeCalculationInput): boolean {
  if (rule.currency !== null && rule.currency !== input.currency) return false;
  if (rule.country !== null && rule.country !== (input.country ?? null)) return false;
  if (rule.source_type !== null && rule.source_type !== (input.sourceType ?? null)) return false;
  if (rule.destination_type !== null && rule.destination_type !== (input.destinationType ?? null)) return false;
  if (rule.provider !== null && rule.provider !== (input.provider ?? null)) return false;
  if (rule.transaction_type !== null && rule.transaction_type !== (input.transactionType ?? null)) return false;
  if (rule.user_tier !== null && rule.user_tier !== (input.userTier ?? null)) return false;
  if (rule.min_amount !== null && input.amount < rule.min_amount) return false;
  if (rule.max_amount !== null && input.amount > rule.max_amount) return false;
  return true;
}

/**
 * Spécificité = nombre de dimensions contraintes (non NULL). Une règle
 * qui cible précisément un fournisseur et une devise l'emporte sur la
 * règle générique qui ne contraint que la devise.
 */
export function ruleSpecificity(rule: FeeRule): number {
  const dimensions = [
    rule.country,
    rule.currency,
    rule.source_type,
    rule.destination_type,
    rule.provider,
    rule.transaction_type,
    rule.user_tier,
  ];
  const amountRangeScore = rule.min_amount !== null || rule.max_amount !== null ? 1 : 0;
  return dimensions.filter((d) => d !== null).length + amountRangeScore;
}

/**
 * Retient la règle la plus spécifique parmi celles qui correspondent
 * (voir shared/pick-most-specific.ts). En cas d'égalité, la première
 * règle rencontrée est conservée — aucune règle réelle ne devrait
 * produire d'égalité en pratique.
 */
export function pickMostSpecificRule(rules: FeeRule[], input: FeeCalculationInput): FeeRule | null {
  return pickMostSpecific(
    rules,
    (rule) => rule.active && ruleMatches(rule, input),
    ruleSpecificity
  );
}
