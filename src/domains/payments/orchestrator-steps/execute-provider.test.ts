import { describe, expect, it, vi } from "vitest";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest, ResolvedRoute } from "./types";
import type { ProviderAdapter } from "@/domains/providers/types";

/**
 * Prompt 30 (Final Production Gate) — audit explicite « timeout » du
 * Master Prompt : TIMEOUT existait déjà comme OrchestratorErrorCode et
 * dans le mapping failureStatusFor (orchestrator.ts), mais aucun code
 * ne le déclenchait jamais avant ce prompt. Couvre withTimeout en
 * isolation (rapide, pas de vrai délai de 30s) et son branchement réel
 * dans executeProviderTransfer via un adapter fictif qui ne répond
 * jamais, à la place du registre réel (registry mocké pour ce fichier).
 */

const slowAdapter: ProviderAdapter = {
  provider: "orange",
  mode: "SANDBOX",
  linkAccount: vi.fn(),
  getBalance: vi.fn(),
  transfer: () => new Promise(() => {}),
  receive: () => new Promise(() => {}),
  getTransactionStatus: vi.fn(),
  cancelTransaction: vi.fn(),
  refund: vi.fn(),
  verifyAndParseWebhook: vi.fn(),
  healthCheck: vi.fn(),
};

vi.mock("@/domains/providers/registry", () => ({
  getProviderAdapter: () => slowAdapter,
}));

const { withTimeout, executeProviderTransfer } = await import("./execute-provider");

describe("withTimeout (Prompt 30)", () => {
  it("résout normalement quand la promesse est plus rapide que le délai", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("rejette avec OrchestratorError TIMEOUT quand la promesse dépasse le délai", async () => {
    const neverResolves = new Promise(() => {});
    const caught = await withTimeout(neverResolves, 10).catch((e) => e);
    expect(caught).toBeInstanceOf(OrchestratorError);
    expect((caught as OrchestratorError).code).toBe("TIMEOUT");
  });

  it("propage l'erreur d'origine si la promesse échoue avant le délai", async () => {
    const caught = await withTimeout(Promise.reject(new Error("boom")), 50).catch((e) => e);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("boom");
  });
});

describe("executeProviderTransfer — branchement réel du timeout (Prompt 30)", () => {
  it("un fournisseur qui ne répond jamais se termine en TIMEOUT, pas en attente indéfinie", async () => {
    const request = {
      senderUserId: "sender",
      recipientUserId: null,
      sourceType: "linked_account",
      sourceLinkedAccountId: "linked-1",
      destinationType: "external",
      destinationLinkedAccountId: null,
      destinationExternalReference: "+225070000001",
      amount: 1_000,
      currency: "XOF",
      pin: "159357",
      idempotencyKey: "vitest-timeout",
    } satisfies PaymentRequest;
    const route: ResolvedRoute = { provider: "orange", linkedAccountId: "linked-1", externalReference: "+225070000000" };

    const caught = await executeProviderTransfer(request, route, 0, 15).catch((e) => e);
    expect(caught).toBeInstanceOf(OrchestratorError);
    expect((caught as OrchestratorError).code).toBe("TIMEOUT");
  });
});
