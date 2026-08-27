import { describe, expect, it } from "vitest";
import {
  checkAmountMismatch,
  checkDuplicate,
  checkMissing,
  checkSettlementMismatch,
  checkStatusMismatch,
} from "./checks";
import type { LedgerView, ProviderView, SettlementView } from "./types";

function ledger(overrides: Partial<LedgerView> = {}): LedgerView {
  return { entryCount: 2, totalDebit: 5_175, totalCredit: 5_175, entries: [], ...overrides };
}
function provider(overrides: Partial<ProviderView> = {}): ProviderView {
  return { checked: false, providerTransactionId: null, status: null, ...overrides };
}
function settlement(overrides: Partial<SettlementView> = {}): SettlementView {
  return {
    status: "settled",
    amount: 5_000,
    fee: 175,
    total: 5_175,
    feePayer: "sender",
    expectedSenderDebit: 5_175,
    ...overrides,
  };
}

describe("checkMissing — SETTLEMENT réglée mais aucune écriture LEDGER", () => {
  it("détecte une transaction réglée sans écriture Ledger", () => {
    const anomaly = checkMissing(settlement(), ledger({ entryCount: 0 }));
    expect(anomaly?.type).toBe("missing");
  });

  it("ne détecte rien quand des écritures existent", () => {
    expect(checkMissing(settlement(), ledger({ entryCount: 2 }))).toBeNull();
  });

  it("ne détecte rien pour une transaction non réglée sans écriture (échec normal, pas une anomalie)", () => {
    expect(checkMissing(settlement({ status: "failed" }), ledger({ entryCount: 0 }))).toBeNull();
  });
});

describe("checkDuplicate — plusieurs écritures pour le même (compte, sens)", () => {
  it("détecte deux débits sur le même compte", () => {
    const anomaly = checkDuplicate(
      settlement(),
      ledger({
        entries: [
          { accountId: "acc-1", direction: "debit", amount: 5_175 },
          { accountId: "acc-1", direction: "debit", amount: 5_175 },
        ],
      }),
      provider()
    );
    expect(anomaly?.type).toBe("duplicate");
  });

  it("ne détecte rien pour un débit et un crédit distincts sur le même compte", () => {
    const anomaly = checkDuplicate(
      settlement(),
      ledger({
        entries: [
          { accountId: "acc-1", direction: "debit", amount: 5_175 },
          { accountId: "acc-2", direction: "credit", amount: 5_175 },
        ],
      }),
      provider()
    );
    expect(anomaly).toBeNull();
  });
});

describe("checkAmountMismatch — débit LEDGER réel vs débit attendu SETTLEMENT", () => {
  it("détecte un débit réel différent du débit attendu", () => {
    const anomaly = checkAmountMismatch(
      settlement({ expectedSenderDebit: 5_175 }),
      ledger({ entryCount: 1, entries: [{ accountId: "acc-1", direction: "debit", amount: 5_000 }] }),
      provider()
    );
    expect(anomaly?.type).toBe("amount_mismatch");
  });

  it("ne détecte rien quand le débit réel correspond exactement", () => {
    const anomaly = checkAmountMismatch(
      settlement({ expectedSenderDebit: 5_175 }),
      ledger({ entryCount: 1, entries: [{ accountId: "acc-1", direction: "debit", amount: 5_175 }] }),
      provider()
    );
    expect(anomaly).toBeNull();
  });

  it("ignore les transactions non réglées ou sans écriture", () => {
    expect(checkAmountMismatch(settlement({ status: "failed" }), ledger({ entryCount: 0 }), provider())).toBeNull();
  });
});

describe("checkStatusMismatch — statut interne vs statut fournisseur", () => {
  it("détecte réglée en interne mais non confirmée côté fournisseur", () => {
    const anomaly = checkStatusMismatch(
      settlement({ status: "settled" }),
      ledger(),
      provider({ checked: true, status: "pending" })
    );
    expect(anomaly?.type).toBe("status_mismatch");
  });

  it("détecte échouée en interne mais confirmée côté fournisseur", () => {
    const anomaly = checkStatusMismatch(
      settlement({ status: "failed" }),
      ledger(),
      provider({ checked: true, status: "confirmed" })
    );
    expect(anomaly?.type).toBe("status_mismatch");
  });

  it("ne détecte rien quand le fournisseur n'a pas été vérifié (virement portefeuille pur)", () => {
    expect(checkStatusMismatch(settlement(), ledger(), provider({ checked: false }))).toBeNull();
  });

  it("ne détecte rien quand les deux statuts concordent", () => {
    expect(
      checkStatusMismatch(settlement({ status: "settled" }), ledger(), provider({ checked: true, status: "confirmed" }))
    ).toBeNull();
  });
});

describe("checkSettlementMismatch — débits ≠ crédits dans le Ledger", () => {
  it("détecte un déséquilibre débit/crédit", () => {
    const anomaly = checkSettlementMismatch(
      settlement(),
      ledger({ entryCount: 2, totalDebit: 5_175, totalCredit: 5_000 }),
      provider()
    );
    expect(anomaly?.type).toBe("settlement_mismatch");
  });

  it("ne détecte rien quand débits et crédits sont équilibrés", () => {
    expect(
      checkSettlementMismatch(settlement(), ledger({ entryCount: 2, totalDebit: 5_175, totalCredit: 5_175 }), provider())
    ).toBeNull();
  });
});
