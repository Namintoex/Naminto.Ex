import "server-only";
import { checkLimits as checkLimitsFromEngine } from "@/domains/payments/limit-engine";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest, ResolvedRoute } from "./types";

/**
 * Étape 5 — Limits. Délègue entièrement au Limit Engine (Prompt 11) :
 * aucune règle de plafond n'est codée ici. `route` doit déjà être
 * résolu, `provider` étant l'une des dimensions sur lesquelles une règle
 * peut se spécialiser.
 */
export async function checkLimits(request: PaymentRequest, route: ResolvedRoute): Promise<void> {
  const decision = await checkLimitsFromEngine({
    userId: request.senderUserId,
    amount: request.amount,
    currency: request.currency,
    provider: route.provider,
    transactionType: "send",
  });

  if (!decision.allowed) {
    throw new OrchestratorError(
      "LIMIT_ERROR",
      decision.violations.map((v) => v.message).join(" "),
      { violations: decision.violations }
    );
  }
}
