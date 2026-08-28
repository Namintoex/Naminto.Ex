import "server-only";
import { getProviderAdapter } from "@/domains/providers/registry";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest, ResolvedRoute } from "./types";

/** Délai raisonnable au-delà duquel un appel fournisseur est considéré perdu (Prompt 30) — aucune source ne documente de valeur, choix d'implémentation comme les seuils du Risk Engine (ADR-045). */
export const PROVIDER_CALL_TIMEOUT_MS = 30_000;

/**
 * Course entre `promise` et un délai — rejette avec un `OrchestratorError`
 * `TIMEOUT` explicite plutôt que de laisser l'appelant indéfiniment en
 * attente. Le code `TIMEOUT` existait déjà dans `OrchestratorErrorCode`
 * et dans le mapping `failureStatusFor` (`orchestrator.ts`) mais n'était
 * jamais réellement atteignable avant ce correctif (Prompt 30, audit
 * « timeout » du Master Prompt).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new OrchestratorError("TIMEOUT", `Appel fournisseur sans réponse après ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Étape 8 — Provider Gateway. N'appelle jamais un fournisseur concret :
 * uniquement l'interface ProviderAdapter résolue par le Provider Registry
 * (Prompt 07). Si `route.provider` est `null` (virement portefeuille à
 * portefeuille pur), cette étape est ignorée par l'orchestrateur.
 */
export async function executeProviderTransfer(
  request: PaymentRequest,
  route: ResolvedRoute,
  fee: number,
  timeoutMs: number = PROVIDER_CALL_TIMEOUT_MS
): Promise<{ providerTransactionId: string }> {
  if (!route.provider || !route.externalReference) {
    throw new OrchestratorError("SYSTEM_ERROR", "executeProviderTransfer appelé sans fournisseur résolu");
  }

  const adapter = getProviderAdapter(route.provider);
  const direction = request.sourceType === "linked_account" ? "transfer" : "receive";

  let result;
  try {
    result = await withTimeout(
      direction === "transfer"
        ? adapter.transfer({
            externalReference: route.externalReference,
            amount: request.amount + fee,
            currency: request.currency,
            idempotencyKey: request.idempotencyKey,
            reference: request.idempotencyKey,
          })
        : adapter.receive({
            externalReference: route.externalReference,
            amount: request.amount,
            currency: request.currency,
            idempotencyKey: request.idempotencyKey,
            reference: request.idempotencyKey,
          }),
      timeoutMs
    );
  } catch (err) {
    if (err instanceof OrchestratorError) throw err;
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
