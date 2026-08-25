import "server-only";
import { calculateFee as calculateFeeFromEngine } from "@/domains/payments/fee-engine";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest, ResolvedRoute } from "./types";
import type { FeeCalculationResult } from "@/domains/payments/fee-engine";

/**
 * Étape 6 — Fee. Délègue entièrement au Fee Engine (Prompt 10) : aucune
 * règle tarifaire n'est codée ici. `route` doit déjà être résolu (voir
 * orchestrator.ts — Routing précède Fee dans cette implémentation,
 * puisque `provider` est l'une des dimensions sur lesquelles une règle
 * peut se spécialiser).
 */
export async function calculateFee(request: PaymentRequest, route: ResolvedRoute): Promise<FeeCalculationResult> {
  try {
    return await calculateFeeFromEngine({
      amount: request.amount,
      currency: request.currency,
      sourceType: request.sourceType,
      destinationType: request.destinationType,
      provider: route.provider,
      transactionType: "send",
    });
  } catch (err) {
    throw new OrchestratorError("SYSTEM_ERROR", `Fee Engine: ${(err as Error).message}`);
  }
}
