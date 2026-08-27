import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction, transitionTransaction } from "@/domains/payments/transactions";
import { recordSettlement } from "@/domains/payments/ledger";
import { reconcileTransaction } from "./run";

/**
 * Test d'intégration contre le vrai projet Supabase de Naminto.Ex.
 * Fait avancer une transaction jusqu'à `settled` en suivant exactement la
 * State Machine (transaction-status.ts) — aucun raccourci direct en base,
 * pour rester représentatif du chemin réel de l'orchestrateur.
 */
describe("reconciliation — reconcileTransaction (intégration)", () => {
  const admin = createAdminClient();
  let senderId: string;
  const senderEmail = `vitest-reco-sender-${randomUUID()}@example.test`;
  const createdTransactionIds: string[] = [];

  async function settleTestTransaction(overrides: Partial<Parameters<typeof createTransaction>[0]> = {}) {
    const tx = await createTransaction({
      senderUserId: senderId,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      destinationExternalReference: "+225070000000",
      provider: null,
      amount: 5_000,
      fee: 175,
      idempotencyKey: `vitest-reco-${randomUUID()}`,
      ...overrides,
    });
    createdTransactionIds.push(tx.id);

    await transitionTransaction(tx.id, "validating");
    await transitionTransaction(tx.id, "authentication_required");
    await transitionTransaction(tx.id, "authenticated");
    await transitionTransaction(tx.id, "processing");
    await transitionTransaction(tx.id, "provider_confirmed");
    return transitionTransaction(tx.id, "settled");
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: senderEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_reco_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Reconciliation" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    senderId = data.user.id;
  });

  afterAll(async () => {
    if (createdTransactionIds.length > 0) {
      await admin.from("reconciliation_anomalies").delete().in("transaction_id", createdTransactionIds);
    }
    if (senderId) await admin.auth.admin.deleteUser(senderId);
  });

  it("ne détecte aucune anomalie pour un règlement propre (Ledger écrit, équilibré)", async () => {
    const tx = await settleTestTransaction();
    await recordSettlement(tx.id);

    const result = await reconcileTransaction(tx.id);

    expect(result?.anomalies).toEqual([]);
    expect(result?.skippedExisting).toEqual([]);
  });

  it("détecte une anomalie 'missing' quand le règlement n'a jamais atteint le Ledger, puis ne la recrée pas au rejeu", async () => {
    const tx = await settleTestTransaction();
    // recordSettlement volontairement omis : simule un règlement perdu en route.

    const first = await reconcileTransaction(tx.id);
    expect(first?.anomalies.map((a) => a.type)).toEqual(["missing"]);

    const { count } = await admin
      .from("reconciliation_anomalies")
      .select("id", { count: "exact", head: true })
      .eq("transaction_id", tx.id);
    expect(count).toBe(1);

    const second = await reconcileTransaction(tx.id);
    expect(second?.anomalies).toEqual([]);
    expect(second?.skippedExisting).toEqual(["missing"]);

    const { count: countAfter } = await admin
      .from("reconciliation_anomalies")
      .select("id", { count: "exact", head: true })
      .eq("transaction_id", tx.id);
    expect(countAfter).toBe(1);
  });

  it("renvoie null pour une transaction inexistante", async () => {
    expect(await reconcileTransaction(randomUUID())).toBeNull();
  });
});
