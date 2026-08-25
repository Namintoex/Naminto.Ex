import "server-only";
import { getProviderAdapter } from "@/domains/providers/registry";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest, ResolvedRoute } from "./types";

/**
 * Étape 8 — Provider Gateway. N'appelle jamais un fournisseur concret :
 * uniquement l'interface ProviderAdapter résolue par le Provider Registry
 * (Prompt 07). Si `route.provider` est `null` (virement portefeuille à
 * portefeuille pur), cette étape est ignorée par l'orchestrateur.
 */
export async function executeProviderTransfer(
  request: PaymentRequest,
  route: ResolvedRoute,
  fee: number
): Promise<{ providerTransactionId: string }> {
  if (!route.provider || !route.externalReference) {
    throw new OrchestratorError("SYSTEM_ERROR", "executeProviderTransfer appelé sans fournisseur résolu");
  }

  const adapter = getProviderAdapter(route.provider);
  const direction = request.sourceType === "linked_account" ? "transfer" : "receive";

  let result;
  try {
    result =
      direction === "transfer"
        ? await adapter.transfer({
            externalReference: route.externalReference,
            amount: request.amount + fee,
            currency: request.currency,
            idempotencyKey: request.idempotencyKey,
            reference: request.idempotencyKey,
          })
        : await adapter.receive({
            externalReference: route.externalReference,
            amount: request.amount,
            currency: request.currency,
            idempotencyKey: request.idempotencyKey,
            reference: request.idempotencyKey,
          });
  } catch (err) {
    throw new OrchestratorError("PROVIDER_ERROR", `Appel fournisseur échoué: ${(err as Error).message}`);
  }

  if (result.status === "failed") {
    throw new OrchestratorError("PROVIDER_ERROR", `Fournisseur a refusé l'opération: ${result.reason ?? "unknown"}`, {
      providerTransactionId: result.providerTransactionId,
      reason: result.reason,
    });
  }

  return { providerTransactionId: result.providerTransactionId };
}
