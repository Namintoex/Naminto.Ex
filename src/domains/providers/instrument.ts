import "server-only";
import { logProviderCall } from "@/domains/observability/log-provider-call";
import { getRequestId } from "@/domains/observability/request-context";
import type { ProviderAdapter } from "./types";

const TIMED_METHODS = [
  "linkAccount",
  "getBalance",
  "transfer",
  "receive",
  "getTransactionStatus",
  "cancelTransaction",
  "refund",
  "healthCheck",
] as const satisfies readonly (keyof ProviderAdapter)[];

function extractProviderTransactionId(result: unknown): string | null {
  if (typeof result === "object" && result !== null && "providerTransactionId" in result) {
    const value = (result as { providerTransactionId: unknown }).providerTransactionId;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/**
 * Instrumente un ProviderAdapter (Prompt 27 — provider latency, provider
 * errors) au point central du Provider Gateway, jamais dans chaque
 * adapter individuellement (registry.ts reste l'unique endroit à
 * modifier pour ajouter un fournisseur — Prompt 07). `verifyAndParseWebhook`
 * n'est délibérément pas chronométré ici : ce n'est pas un appel réseau,
 * et son propre audit existe déjà (webhook_events, Prompt 25).
 */
export function instrumentAdapter(adapter: ProviderAdapter): ProviderAdapter {
  const instrumented: ProviderAdapter = { ...adapter };

  for (const method of TIMED_METHODS) {
    const original = adapter[method] as (...args: unknown[]) => Promise<unknown>;
    (instrumented as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
      const startedAt = Date.now();
      const requestId = await getRequestId();
      try {
        const result = await original.apply(adapter, args);
        await logProviderCall({
          requestId,
          provider: adapter.provider,
          operation: method,
          durationMs: Date.now() - startedAt,
          success: true,
          providerTransactionId: extractProviderTransactionId(result),
        });
        return result;
      } catch (err) {
        await logProviderCall({
          requestId,
          provider: adapter.provider,
          operation: method,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage: err instanceof Error ? err.message : "unknown error",
        });
        throw err;
      }
    };
  }

  return instrumented;
}
