import type { Database } from "@/lib/supabase/database.types";
import { pickMostSpecific } from "../shared/pick-most-specific";
import type { ComplianceCheckInput } from "./types";

export type ComplianceRule = Database["public"]["Tables"]["compliance_rules"]["Row"];

/**
 * Même principe que le Fee Engine (Prompt 10) et le Limit Engine
 * (Prompt 11) : une règle correspond si, pour chaque dimension qu'elle
 * contraint (valeur non NULL), la requête a exactement cette valeur.
 */
export function ruleMatches(rule: ComplianceRule, input: ComplianceCheckInput): boolean {
  if (rule.currency !== null && rule.currency !== input.currency) return false;
  if (rule.country !== null && rule.country !== (input.country ?? null)) return false;
  if (rule.source_type !== null && rule.source_type !== (input.sourceType ?? null)) return false;
  if (rule.destination_type !== null && rule.destination_type !== (input.destinationType ?? null)) return false;
  if (rule.min_amount !== null && input.amount < rule.min_amount) return false;
  if (rule.max_amount !== null && input.amount > rule.max_amount) return false;
  return true;
}

export function ruleSpecificity(rule: ComplianceRule): number {
  const dimensions = [rule.country, rule.currency, rule.source_type, rule.destination_type];
  const amountRangeScore = rule.min_amount !== null || rule.max_amount !== null ? 1 : 0;
  return dimensions.filter((d) => d !== null).length + amountRangeScore;
}

/**
 * Retient la règle active la plus spécifique parmi celles qui
 * correspondent (voir shared/pick-most-specific.ts). Aucune règle qui
 * corresponde ⇒ `null`, traité comme `NONE` par determine-requirement.ts
 * — absence de règle n'est jamais une exigence, jamais un refus (même
 * principe que le Limit Engine, ADR-036).
 */
export function pickMostSpecificRule(rules: ComplianceRule[], input: ComplianceCheckInput): ComplianceRule | null {
  return pickMostSpecific(rules, (rule) => rule.active && ruleMatches(rule, input), ruleSpecificity);
}
