import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction } from "@/domains/payments/transactions";
import { recordRefund, recordReversal, recordSettlement, writeBalancedEntries } from "./record-entries";
import {
  LedgerCurrencyMismatchError,
  LedgerImbalanceError,
  LedgerInvalidAmountError,
  LedgerMissingSettlementError,
  LedgerTransactionNotFoundError,
} from "./types";

/**
 * Test d'intégration contre le vrai projet Supabase — couvre les cas
 * explicitement exigés par le Prompt 12 : double écriture, montant
 * négatif, devise incorrecte, transaction inexistante, reversal, refund.
 *
 * ledger_entries est append-only même pour service_role (voir
 * 0008_ledger.sql) : les transactions qui ont réellement été réglées
 * pendant ce test conservent définitivement leurs écritures en base,
 * comme en production — seules les transactions n'ayant jamais atteint
 * le règlement sont supprimées en fin de test (voir afterAll).
 */
describe("Ledger — record-entries (intégration)", () => {
  const admin = createAdminClient();
  let senderId: string;
  let recipientId: string;
  const senderEmail = `vitest-ledger-sender-${randomUUID()}@example.test`;
  const recipientEmail = `vitest-ledger-recipient-${randomUUID()}@example.test`;
  const createdTransactionIds: string[] = [];

  async function createTestTransaction(
    overrides: Partial<Parameters<typeof createTransaction>[0]> = {}
  ) {
    const tx = await createTransaction({
      senderUserId: senderId,
      recipientUserId: recipientId,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "naminto_wallet",
      destinationReference: null,
      provider: null,
      amount: 5_000,
      currency: "XOF",
      fee: 175,
      idempotencyKey: `vitest-ledger-${randomUUID()}`,
      ...overrides,
    });
    createdTransactionIds.push(tx.id);
    return tx;
  }

  beforeAll(async () => {
    const sender = await admin.auth.admin.createUser({
      email: senderEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_ledger_snd_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Ledger Sender" },
    });
    if (sender.error || !sender.data.user) {
      throw new Error(`Impossible de créer l'expéditeur de test: ${sender.error?.message}`);
    }
    senderId = sender.data.user.id;

    const recipient = await admin.auth.admin.createUser({
      email: recipientEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_ledger_rcp_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Ledger Recipient" },
    });
    if (recipient.error || !recipient.data.user) {
      throw new Error(`Impossible de créer le destinataire de test: ${recipient.error?.message}`);
    }
    recipientId = recipient.data.user.id;
  });

  afterAll(async () => {
    if (createdTransactionIds.length > 0) {
      const { data: settledEntries } = await admin
        .from("ledger_entries")
        .select("transaction_id")
        .in("transaction_id", createdTransactionIds);
      const settledIds = new Set((settledEntries ?? []).map((e) => e.transaction_id));
      const deletableIds = createdTransactionIds.filter((id) => !settledIds.has(id));
      if (deletableIds.length > 0) {
        await admin.from("transactions").delete().in("id", deletableIds);
      }
    }
    if (recipientId) await admin.auth.admin.deleteUser(recipientId);
    if (senderId) await admin.auth.admin.deleteUser(senderId);
  });

  it("frais payés par l'expéditeur : débit expéditeur = montant + frais, écritures équilibrées", async () => {
    const tx = await createTestTransaction({ feePayer: "sender", amount: 5_000, fee: 175 });

    const entries = await recordSettlement(tx.id);

    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.kind === "settlement" && e.reference === tx.reference)).toBe(true);

    const debit = entries.find((e) => e.direction === "debit");
    const credits = entries.filter((e) => e.direction === "credit");
    expect(Number(debit?.amount)).toBe(5_175);
    expect(credits.map((e) => Number(e.amount)).sort((a, b) => a - b)).toEqual([175, 5_000]);

    const totalDebit = entries.filter((e) => e.direction === "debit").reduce((s, e) => s + Number(e.amount), 0);
    const totalCredit = entries.filter((e) => e.direction === "credit").reduce((s, e) => s + Number(e.amount), 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("frais payés par le destinataire : montant reçu réduit, débit expéditeur inchangé", async () => {
    const tx = await createTestTransaction({ feePayer: "recipient", amount: 5_000, fee: 175 });

    const entries = await recordSettlement(tx.id);

    const debit = entries.find((e) => e.direction === "debit");
    expect(Number(debit?.amount)).toBe(5_000);
    const recipientCredit = entries.filter((e) => e.direction === "credit").map((e) => Number(e.amount));
    expect(recipientCredit.sort((a, b) => a - b)).toEqual([175, 4_825]);
  });

  it("double écriture : rejouer recordSettlement ne crée pas de deuxième lot (idempotent)", async () => {
    const tx = await createTestTransaction();

    const first = await recordSettlement(tx.id);
    const second = await recordSettlement(tx.id);

    expect(second.map((e) => e.id).sort()).toEqual(first.map((e) => e.id).sort());

    const { count } = await admin
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("transaction_id", tx.id)
      .eq("kind", "settlement");
    expect(count).toBe(first.length);
  });

  it("montant négatif : le domaine rejette le lot avant toute écriture en base", async () => {
    await expect(
      writeBalancedEntries(randomUUID(), "settlement", "TEST-REF", [
        { accountRef: { ownerType: "fee_revenue", currency: "XOF" }, direction: "debit", amount: -10, currency: "XOF" },
        { accountRef: { ownerType: "fee_revenue", currency: "XOF" }, direction: "credit", amount: -10, currency: "XOF" },
      ])
    ).rejects.toBeInstanceOf(LedgerInvalidAmountError);
  });

  it("devise incorrecte : rejette un lot mêlant plusieurs devises", async () => {
    await expect(
      writeBalancedEntries(randomUUID(), "settlement", "TEST-REF", [
        { accountRef: { ownerType: "fee_revenue", currency: "XOF" }, direction: "debit", amount: 100, currency: "XOF" },
        { accountRef: { ownerType: "fee_revenue", currency: "EUR" }, direction: "credit", amount: 100, currency: "EUR" },
      ])
    ).rejects.toBeInstanceOf(LedgerCurrencyMismatchError);
  });

  it("lot déséquilibré : rejette quand la somme des débits diffère de celle des crédits", async () => {
    await expect(
      writeBalancedEntries(randomUUID(), "settlement", "TEST-REF", [
        { accountRef: { ownerType: "fee_revenue", currency: "XOF" }, direction: "debit", amount: 100, currency: "XOF" },
        { accountRef: { ownerType: "fee_revenue", currency: "XOF" }, direction: "credit", amount: 90, currency: "XOF" },
      ])
    ).rejects.toBeInstanceOf(LedgerImbalanceError);
  });

  it.each([
    ["recordSettlement", recordSettlement],
    ["recordReversal", recordReversal],
    ["recordRefund", recordRefund],
  ])("transaction inexistante : %s lève LedgerTransactionNotFoundError", async (_name, fn) => {
    await expect(fn(randomUUID())).rejects.toBeInstanceOf(LedgerTransactionNotFoundError);
  });

  it("reversal : écritures miroir équilibrées après un règlement", async () => {
    const tx = await createTestTransaction({ feePayer: "sender", amount: 3_000, fee: 105 });
    const settlement = await recordSettlement(tx.id);

    const reversal = await recordReversal(tx.id);

    expect(reversal).toHaveLength(settlement.length);
    expect(reversal.every((e) => e.kind === "reversal")).toBe(true);
    const totalDebit = reversal.filter((e) => e.direction === "debit").reduce((s, e) => s + Number(e.amount), 0);
    const totalCredit = reversal.filter((e) => e.direction === "credit").reduce((s, e) => s + Number(e.amount), 0);
    expect(totalDebit).toBe(totalCredit);
    // Chaque compte de la transaction a désormais un débit et un crédit
    // (règlement + inverse) : l'effet net sur le grand livre est nul.
    const settlementByAccount = new Map(settlement.map((e) => [e.account_id, e.direction]));
    for (const e of reversal) {
      expect(e.direction).not.toBe(settlementByAccount.get(e.account_id));
    }
  });

  it("reversal sans règlement préalable lève LedgerMissingSettlementError", async () => {
    const tx = await createTestTransaction();
    await expect(recordReversal(tx.id)).rejects.toBeInstanceOf(LedgerMissingSettlementError);
  });

  it("refund : écritures miroir équilibrées, idempotent au rejeu", async () => {
    const tx = await createTestTransaction({ feePayer: "recipient", amount: 4_000, fee: 140 });
    await recordSettlement(tx.id);

    const first = await recordRefund(tx.id);
    const second = await recordRefund(tx.id);

    expect(second.map((e) => e.id).sort()).toEqual(first.map((e) => e.id).sort());
    expect(first.every((e) => e.kind === "refund")).toBe(true);
  });
});
