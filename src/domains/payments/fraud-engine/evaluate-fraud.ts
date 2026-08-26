import type { RiskDecision, RiskSignal } from "@/domains/payments/risk-engine";
import { FRAUD_RULES } from "./rules";
import type { FraudAction, FraudDecision, FraudRuleContext, FraudRuleResult } from "./types";

/** BLOCK l'emporte sur MANUAL_REVIEW, qui l'emporte sur STEP_UP, qui
 *  l'emporte sur ALLOW — jamais un score, une hiérarchie explicite. */
const ACTION_RANK: Record<FraudAction, number> = { ALLOW: 0, STEP_UP: 1, MANUAL_REVIEW: 2, BLOCK: 3 };

export function buildFraudContext(
  riskDecision: RiskDecision,
  amount: number,
  currency: string
): FraudRuleContext {
  const signalsByCode = Object.fromEntries(riskDecision.reasons.map((r) => [r.code, r])) as Record<
    RiskSignal["code"],
    RiskSignal
  >;
  return { riskDecision, signalsByCode, amount, currency };
}

/**
 * Fraud Engine (Prompt 18) — évalue chaque règle indépendamment contre
 * le contexte (dérivé du Risk Engine, jamais de nouvelle lecture en
 * base ici, fonction pure), retient toutes celles qui matchent comme
 * trace d'audit, et détermine l'action finale par l'action la plus
 * restrictive parmi les règles déclenchées (jamais la première ou la
 * dernière). Aucune règle déclenchée ⇒ `ALLOW`, aucune trace d'audit à
 * produire (rien d'anormal ne s'est produit).
 */
export function evaluateFraud(context: FraudRuleContext): FraudDecision {
  const matchedRules: FraudRuleResult[] = FRAUD_RULES.filter((rule) => rule.condition(context)).map((rule) => ({
    ruleId: rule.id,
    description: rule.description,
    severity: rule.severity,
    action: rule.action,
  }));

  let action: FraudAction = "ALLOW";
  for (const rule of matchedRules) {
    if (ACTION_RANK[rule.action] > ACTION_RANK[action]) action = rule.action;
  }

  return { action, matchedRules };
}
