import "server-only";
import { assessRisk } from "@/domains/payments/risk-engine";
import type { RiskDecision } from "@/domains/payments/risk-engine";
import type { PaymentRequest } from "./types";

export type { RiskDecision };

/**
 * Étape 3 — Risk (Prompt 17). Délègue entièrement au Risk Engine :
 * aucune règle de risque ici. Renvoie la décision au Payment
 * Orchestrator, qui seul décide d'agir dessus (bloquer sur HIGH) —
 * cette étape elle-même n'écrit jamais nulle part.
 */
export async function checkRisk(request: PaymentRequest): Promise<RiskDecision> {
  return assessRisk({
    senderUserId: request.senderUserId,
    amount: request.amount,
    currency: request.currency,
    destinationType: request.destinationType,
    recipientUserId: request.recipientUserId,
    destinationExternalReference: request.destinationExternalReference,
    deviceFingerprint: request.deviceFingerprint ?? null,
  });
}
