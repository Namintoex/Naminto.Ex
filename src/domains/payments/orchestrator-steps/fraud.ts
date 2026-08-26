import "server-only";
import { logSecurityEvent } from "@/domains/identity/security-events";
import { buildFraudContext, evaluateFraud } from "@/domains/payments/fraud-engine";
import type { FraudDecision } from "@/domains/payments/fraud-engine";
import type { RiskDecision } from "@/domains/payments/risk-engine";
import type { PaymentRequest } from "./types";

export type { FraudDecision };

/**
 * Étape 3bis — Fraud (Prompt 18), juste après Risk. Délègue entièrement
 * à l'architecture de règles du Fraud Engine ; cette étape ne fait que
 * construire le contexte (à partir de la décision Risk déjà calculée,
 * jamais recalculée) et produire la trace d'audit exigée par le
 * Prompt 18 pour chaque règle qui se déclenche — le Fraud Engine
 * lui-même reste une fonction pure, sans effet de bord.
 */
export async function checkFraud(request: PaymentRequest, riskDecision: RiskDecision): Promise<FraudDecision> {
  const context = buildFraudContext(riskDecision, request.amount, request.currency);
  const decision = evaluateFraud(context);

  for (const rule of decision.matchedRules) {
    await logSecurityEvent({
      userId: request.senderUserId,
      type: "fraud_rule_matched",
      metadata: {
        ruleId: rule.ruleId,
        severity: rule.severity,
        action: rule.action,
        description: rule.description,
      },
    });
  }

  return decision;
}
