import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { OrchestratorError } from "../orchestrator-errors";
import { validateRequest } from "./validate";
import type { PaymentRequest } from "./types";

/**
 * validateRequest est pure (aucun accès base) — testable en isolation.
 * Couvre la régression (XOF toujours accepté) et l'extensibilité
 * (Prompt 29, ADR-057) : la liste des devises supportées est un
 * paramètre fourni par l'appelant, plus jamais un tableau codé en dur.
 */
describe("validateRequest — devises (Prompt 29)", () => {
  function baseRequest(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
    return {
      senderUserId: randomUUID(),
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceLinkedAccountId: null,
      destinationType: "external",
      destinationLinkedAccountId: null,
      destinationExternalReference: "+225070000001",
      amount: 5_000,
      currency: "XOF",
      pin: "159357",
      idempotencyKey: `vitest-validate-${randomUUID()}`,
      ...overrides,
    };
  }

  it("régression : XOF reste accepté quand il fait partie des devises supportées", () => {
    expect(() => validateRequest(baseRequest({ currency: "XOF" }), ["XOF"])).not.toThrow();
  });

  it("extensibilité : une devise nouvellement seedée est acceptée dès qu'elle apparaît dans la liste fournie", () => {
    expect(() => validateRequest(baseRequest({ currency: "GHS" }), ["XOF", "GHS"])).not.toThrow();
  });

  it("rejette une devise absente de la liste fournie, même si la liste n'est pas vide", () => {
    expect(() => validateRequest(baseRequest({ currency: "USD" }), ["XOF", "GHS"])).toThrow(OrchestratorError);
  });

  it("rejette toute devise quand la liste fournie est vide (aucun pays actif)", () => {
    expect(() => validateRequest(baseRequest({ currency: "XOF" }), [])).toThrow(OrchestratorError);
  });
});
