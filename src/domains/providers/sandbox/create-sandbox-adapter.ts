import "server-only";
import { randomUUID } from "crypto";
import type { Provider } from "@/lib/supabase/database.types";
import type {
  ProviderAdapter,
  ProviderBalance,
  ProviderCancelResult,
  ProviderHealth,
  ProviderLinkParams,
  ProviderLinkResult,
  ProviderRefundResult,
  ProviderTransferParams,
  ProviderTransferResult,
  ProviderWebhookEvent,
} from "../types";

export interface SandboxProviderConfig {
  provider: Provider;
  capabilities: string[];
  /** Solde de départ simulé (FCFA) pour toute nouvelle référence. */
  startingBalance?: number;
  supportsRefund?: boolean;
}

/**
 * Fabrique un adapter SANDBOX générique : simule le comportement d'un
 * fournisseur sans jamais appeler d'API réelle. L'état (soldes,
 * transactions simulées) vit en mémoire pour la durée du process serveur
 * — attendu pour un sandbox de développement, pas pour la production.
 *
 * Chaque fournisseur (voir src/domains/providers/sandbox/{orange,mtn,...})
 * ne fait qu'appeler cette fabrique avec sa propre configuration : ajouter
 * un nouveau fournisseur ne nécessite qu'un nouvel appel ici, jamais de
 * modification du cœur financier (Prompt 07).
 */
export function createSandboxAdapter(config: SandboxProviderConfig): ProviderAdapter {
  const balances = new Map<string, number>();
  const transactions = new Map<string, { status: "pending" | "confirmed" | "failed" }>();
  const seenIdempotencyKeys = new Map<string, ProviderTransferResult>();

  function getOrInitBalance(externalReference: string): number {
    if (!balances.has(externalReference)) {
      balances.set(externalReference, config.startingBalance ?? 250_000);
    }
    return balances.get(externalReference)!;
  }

  /** Débite le compte lié — argent qui en sort vers Naminto.Ex/ailleurs. */
  async function executeTransfer(params: ProviderTransferParams): Promise<ProviderTransferResult> {
    const existing = seenIdempotencyKeys.get(params.idempotencyKey);
    if (existing) {
      return existing;
    }

    const balance = getOrInitBalance(params.externalReference);
    const providerTransactionId = `${config.provider}_${randomUUID()}`;

    if (params.amount > balance) {
      const failed: ProviderTransferResult = {
        providerTransactionId,
        status: "failed",
        reason: "INSUFFICIENT_FUNDS",
      };
      transactions.set(providerTransactionId, { status: "failed" });
      seenIdempotencyKeys.set(params.idempotencyKey, failed);
      return failed;
    }

    balances.set(params.externalReference, balance - params.amount);
    transactions.set(providerTransactionId, { status: "confirmed" });
    const result: ProviderTransferResult = { providerTransactionId, status: "confirmed" };
    seenIdempotencyKeys.set(params.idempotencyKey, result);
    return result;
  }

  /** Crédite le compte lié — argent qui y entre depuis Naminto.Ex. */
  async function executeReceive(params: ProviderTransferParams): Promise<ProviderTransferResult> {
    const existing = seenIdempotencyKeys.get(params.idempotencyKey);
    if (existing) {
      return existing;
    }

    const balance = getOrInitBalance(params.externalReference);
    const providerTransactionId = `${config.provider}_${randomUUID()}`;

    balances.set(params.externalReference, balance + params.amount);
    transactions.set(providerTransactionId, { status: "confirmed" });
    const result: ProviderTransferResult = { providerTransactionId, status: "confirmed" };
    seenIdempotencyKeys.set(params.idempotencyKey, result);
    return result;
  }

  return {
    provider: config.provider,
    mode: "SANDBOX",

    async linkAccount(params: ProviderLinkParams): Promise<ProviderLinkResult> {
      getOrInitBalance(params.externalReference);
      return {
        externalReference: params.externalReference,
        capabilities: config.capabilities,
        status: "active",
      };
    },

    async getBalance(externalReference: string): Promise<ProviderBalance> {
      return {
        amount: getOrInitBalance(externalReference),
        currency: "XOF",
        asOf: new Date().toISOString(),
      };
    },

    transfer: executeTransfer,
    receive: executeReceive,

    async getTransactionStatus(providerTransactionId: string): Promise<ProviderTransferResult> {
      const tx = transactions.get(providerTransactionId);
      return {
        providerTransactionId,
        status: tx?.status ?? "unknown",
      };
    },

    async cancelTransaction(providerTransactionId: string): Promise<ProviderCancelResult> {
      const tx = transactions.get(providerTransactionId);
      if (!tx || tx.status !== "pending") {
        return { success: false, status: tx?.status ?? "unknown" };
      }
      transactions.set(providerTransactionId, { status: "failed" });
      return { success: true, status: "failed" };
    },

    async refund(providerTransactionId: string): Promise<ProviderRefundResult> {
      if (!config.supportsRefund) {
        return { supported: false };
      }
      const tx = transactions.get(providerTransactionId);
      if (!tx || tx.status !== "confirmed") {
        return { supported: true, success: false };
      }
      return { supported: true, success: true, providerRefundId: `${config.provider}_rf_${randomUUID()}` };
    },

    async verifyAndParseWebhook(payload: string): Promise<ProviderWebhookEvent> {
      // SANDBOX : aucune signature réelle à vérifier — voir Prompt 25
      // (Webhooks) pour la vérification de signature en conditions réelles.
      try {
        const raw = JSON.parse(payload);
        return { type: "sandbox.event", raw };
      } catch {
        return { type: "sandbox.unparsed", raw: payload };
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      return { status: "operational", checkedAt: new Date().toISOString() };
    },
  };
}
