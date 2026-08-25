import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  InvalidTransactionTransitionError,
  TRANSACTION_STATUSES,
  assertTransition,
  canTransition,
  isInFlight,
  isTerminalStatus,
  type TransactionStatus,
} from "./transaction-status";

describe("transaction state machine", () => {
  it("allows every transition documented in PAYMENTS — Spécification Markdown", () => {
    expect(canTransition("created", "validating")).toBe(true);
    expect(canTransition("validating", "authentication_required")).toBe(true);
    expect(canTransition("validating", "failed")).toBe(true);
    expect(canTransition("validating", "rejected")).toBe(true);
    expect(canTransition("authentication_required", "authenticated")).toBe(true);
    expect(canTransition("authentication_required", "expired")).toBe(true);
    expect(canTransition("authentication_required", "cancelled")).toBe(true);
    expect(canTransition("authenticated", "processing")).toBe(true);
    expect(canTransition("processing", "provider_confirmed")).toBe(true);
    expect(canTransition("processing", "failed")).toBe(true);
    expect(canTransition("processing", "expired")).toBe(true);
    expect(canTransition("provider_confirmed", "settled")).toBe(true);
    expect(canTransition("settled", "reversed")).toBe(true);
    expect(canTransition("settled", "refunded")).toBe(true);
    expect(canTransition("settled", "disputed")).toBe(true);
  });

  it("rejects skipping steps (ex. created directement en settled)", () => {
    expect(canTransition("created", "settled")).toBe(false);
    expect(canTransition("created", "processing")).toBe(false);
    expect(canTransition("authenticated", "settled")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(canTransition("processing", "authenticated")).toBe(false);
    expect(canTransition("settled", "processing")).toBe(false);
    expect(canTransition("provider_confirmed", "created")).toBe(false);
  });

  it("treats every non-listed transition as forbidden, exhaustively", () => {
    for (const from of TRANSACTION_STATUSES) {
      for (const to of TRANSACTION_STATUSES) {
        const expected = ALLOWED_TRANSITIONS[from].includes(to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("terminal states have no outgoing transition", () => {
    const terminalStates: TransactionStatus[] = [
      "failed",
      "rejected",
      "expired",
      "cancelled",
      "reversed",
      "refunded",
      "disputed",
    ];
    for (const status of terminalStates) {
      expect(isTerminalStatus(status)).toBe(true);
      expect(ALLOWED_TRANSITIONS[status]).toHaveLength(0);
    }
  });

  it("non-terminal states have at least one outgoing transition", () => {
    const nonTerminal: TransactionStatus[] = [
      "created",
      "validating",
      "authentication_required",
      "authenticated",
      "processing",
      "provider_confirmed",
      "settled",
    ];
    for (const status of nonTerminal) {
      expect(isTerminalStatus(status)).toBe(false);
    }
  });

  it("assertTransition ne lève rien pour une transition valide", () => {
    expect(() => assertTransition("created", "validating")).not.toThrow();
  });

  it("assertTransition lève InvalidTransactionTransitionError pour une transition invalide", () => {
    expect(() => assertTransition("settled", "created")).toThrow(InvalidTransactionTransitionError);
    try {
      assertTransition("failed", "settled");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransactionTransitionError);
      expect((err as InvalidTransactionTransitionError).from).toBe("failed");
      expect((err as InvalidTransactionTransitionError).to).toBe("settled");
    }
  });

  it("settled n'est pas terminal (transitions post-règlement possibles) mais n'est plus in-flight", () => {
    // settled a des transitions sortantes (reversed/refunded/disputed) —
    // isTerminalStatus renvoie donc false, volontairement distinct de
    // isInFlight qui sert au court-circuit de rejeu de l'orchestrateur.
    expect(isTerminalStatus("settled")).toBe(false);
    expect(isInFlight("settled")).toBe(false);
  });

  it("isInFlight distingue les statuts en cours des statuts aboutis (succès ou échec)", () => {
    const inFlight: TransactionStatus[] = [
      "created",
      "validating",
      "authentication_required",
      "authenticated",
      "processing",
      "provider_confirmed",
    ];
    const notInFlight: TransactionStatus[] = [
      "settled",
      "failed",
      "rejected",
      "expired",
      "cancelled",
      "reversed",
      "refunded",
      "disputed",
    ];
    for (const status of inFlight) {
      expect(isInFlight(status)).toBe(true);
    }
    for (const status of notInFlight) {
      expect(isInFlight(status)).toBe(false);
    }
  });

  it("un client ne doit jamais pouvoir modifier librement le statut (aucune transition libre)", () => {
    // Chaque statut ne peut atteindre qu'un sous-ensemble strict des 14 statuts.
    for (const status of TRANSACTION_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status].length).toBeLessThan(TRANSACTION_STATUSES.length);
    }
  });
});
