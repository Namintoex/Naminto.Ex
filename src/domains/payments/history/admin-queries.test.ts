import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TransactionStatus } from "../transaction-status";
import { adminDashboardStats, adminListRiskAndFraudEvents, adminListTransactions } from "./admin-queries";

/**
 * Test d'intégration contre le vrai projet Supabase — fixtures directes
 * (pas l'orchestrateur complet) pour isoler l'agrégation/le filtrage
 * ajoutés par le Back Office, déjà couverts autrement pour la partie
 * métier (orchestrator.test.ts).
 */
describe("Back Office — Transactions/Dashboard/Risk-Fraud admin queries (intégration)", () => {
  const admin = createAdminClient();
  const createdTransactionIds: string[] = [];
  const createdEventIds: string[] = [];

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await admin.from("transaction_status_events").delete().in("id", createdEventIds);
    }
    if (createdTransactionIds.length > 0) {
      await admin.from("transactions").delete().in("id", createdTransactionIds);
    }
  });

  async function makeTransaction(overrides: { status: TransactionStatus }) {
    const reference = `NEX-VITEST${randomUUID().slice(0, 6).toUpperCase()}`;
    const { data: tx } = await admin
      .from("transactions")
      .insert({
        reference,
        source_type: "linked_account",
        destination_type: "external",
        amount: 1000,
        currency: "XOF",
        fee: 35,
        total: 1035,
        fee_payer: "sender",
        idempotency_key: randomUUID(),
        status: overrides.status,
      })
      .select("*")
      .single();
    createdTransactionIds.push(tx!.id);
    return tx!;
  }

  it("adminListTransactions filtre par référence et par statut", async () => {
    const tx = await makeTransaction({ status: "settled" });

    const byReference = await adminListTransactions({ reference: tx.reference });
    expect(byReference.transactions.some((t) => t.id === tx.id)).toBe(true);

    const byStatus = await adminListTransactions({ status: "settled" });
    expect(byStatus.transactions.some((t) => t.id === tx.id)).toBe(true);
  });

  it("adminDashboardStats compte les transactions créées aujourd'hui", async () => {
    const before = await adminDashboardStats();
    await makeTransaction({ status: "settled" });
    await makeTransaction({ status: "failed" });

    const after = await adminDashboardStats();
    expect(after.transactionsToday).toBe(before.transactionsToday + 2);
    expect(after.settledCountToday).toBe(before.settledCountToday + 1);
    expect(after.failedCountToday).toBe(before.failedCountToday + 1);
  });

  it("adminListRiskAndFraudEvents ne relit que les raisons RISK_REJECTION/FRAUD_BLOCKED/MANUAL_REVIEW_REQUIRED, jamais une décision reconstruite", async () => {
    const tx = await makeTransaction({ status: "rejected" });

    const { data: unrelatedEvent } = await admin
      .from("transaction_status_events")
      .insert({ transaction_id: tx.id, to_status: "processing", reason: "SYSTEM_ERROR: hors périmètre" })
      .select("id")
      .single();
    createdEventIds.push(unrelatedEvent!.id);

    const { data: riskEvent } = await admin
      .from("transaction_status_events")
      .insert({ transaction_id: tx.id, to_status: "rejected", reason: "RISK_REJECTION: risque élevé détecté" })
      .select("id")
      .single();
    createdEventIds.push(riskEvent!.id);

    const events = await adminListRiskAndFraudEvents(["RISK_REJECTION"]);
    expect(events.some((e) => e.id === riskEvent!.id && e.reference === tx.reference)).toBe(true);
    expect(events.some((e) => e.id === unrelatedEvent!.id)).toBe(false);
  });
});
