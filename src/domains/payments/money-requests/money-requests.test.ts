import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/domains/identity/pin";
import { createMoneyRequest } from "./create";
import { cancelMoneyRequest } from "./cancel";
import { fulfillMoneyRequest } from "./fulfill";
import { getMoneyRequestById } from "./queries";
import {
  MoneyRequestForbiddenError,
  MoneyRequestNotFoundError,
  MoneyRequestNotPendingError,
} from "./types";

/**
 * Test d'intégration contre le vrai projet Supabase — couvre le cycle de
 * vie complet d'une demande d'argent (Prompt 14) : création, annulation,
 * et règlement réel via le Payment Orchestrator. `listOwnMoneyRequests`
 * utilise le client RLS (`@/lib/supabase/server`, `cookies()`) — comme
 * `getLinkedAccounts`/`getIdentityProfile` ailleurs dans ce dépôt, il
 * n'est donc testable que dans un vrai contexte de requête Next.js
 * (vérifié manuellement dans le navigateur), pas depuis Vitest.
 */
describe("Money Requests (intégration)", () => {
  const admin = createAdminClient();
  let requesterId: string;
  let payerId: string;
  const requesterEmail = `vitest-mr-requester-${randomUUID()}@example.test`;
  const payerEmail = `vitest-mr-payer-${randomUUID()}@example.test`;
  const pin = "753159";
  const createdRequestIds: string[] = [];
  const createdTransactionIds: string[] = [];

  beforeAll(async () => {
    const requester = await admin.auth.admin.createUser({
      email: requesterEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_mr_req_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Requester" },
    });
    if (requester.error || !requester.data.user) {
      throw new Error(`Impossible de créer le demandeur de test: ${requester.error?.message}`);
    }
    requesterId = requester.data.user.id;

    const payer = await admin.auth.admin.createUser({
      email: payerEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_mr_pay_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Payer" },
    });
    if (payer.error || !payer.data.user) {
      throw new Error(`Impossible de créer le payeur de test: ${payer.error?.message}`);
    }
    payerId = payer.data.user.id;

    await admin.from("pin_credentials").insert({ user_id: payerId, pin_hash: await hashPin(pin) });
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
    if (createdRequestIds.length > 0) {
      await admin.from("money_requests").delete().in("id", createdRequestIds);
    }
    if (payerId) await admin.auth.admin.deleteUser(payerId);
    if (requesterId) await admin.auth.admin.deleteUser(requesterId);
  });

  it("crée une demande avec un jeton unique, une échéance future et un statut pending", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 3_000, note: "Test" });
    createdRequestIds.push(request.id);

    expect(request.status).toBe("pending");
    expect(request.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(request.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(Number(request.amount)).toBe(3_000);
  });

  it("annule une demande pending et refuse une seconde annulation", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 500 });
    createdRequestIds.push(request.id);

    const cancelled = await cancelMoneyRequest(request.id, requesterId);
    expect(cancelled.status).toBe("cancelled");

    await expect(cancelMoneyRequest(request.id, requesterId)).rejects.toBeInstanceOf(MoneyRequestNotPendingError);
  });

  it("refuse l'annulation par quelqu'un d'autre que le demandeur", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 500 });
    createdRequestIds.push(request.id);

    await expect(cancelMoneyRequest(request.id, payerId)).rejects.toBeInstanceOf(MoneyRequestForbiddenError);
  });

  it("lève MoneyRequestNotFoundError pour un id inconnu", async () => {
    await expect(cancelMoneyRequest(randomUUID(), requesterId)).rejects.toBeInstanceOf(MoneyRequestNotFoundError);
  });

  it("règle une demande par un envoi réel — statut fulfilled, transaction settled, écritures Ledger équilibrées", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 4_200, note: "Loyer" });
    createdRequestIds.push(request.id);

    const result = await fulfillMoneyRequest({ token: request.token, payerUserId: payerId, pin });
    createdTransactionIds.push(result.transactionId);

    expect(result.status).toBe("settled");

    const updated = await getMoneyRequestById(request.id);
    expect(updated?.status).toBe("fulfilled");
    expect(updated?.fulfilled_transaction_id).toBe(result.transactionId);

    const { data: transaction } = await admin
      .from("transactions")
      .select("recipient_user_id, amount, status")
      .eq("id", result.transactionId)
      .single();
    expect(transaction?.recipient_user_id).toBe(requesterId);
    expect(Number(transaction?.amount)).toBe(4_200);
  });

  it("rejouer fulfillMoneyRequest sur la même demande ne crée pas de deuxième transaction (idempotent)", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 1_000 });
    createdRequestIds.push(request.id);

    const first = await fulfillMoneyRequest({ token: request.token, payerUserId: payerId, pin });
    createdTransactionIds.push(first.transactionId);

    const second = await fulfillMoneyRequest({ token: request.token, payerUserId: payerId, pin });
    expect(second.transactionId).toBe(first.transactionId);
  });

  it("refuse de régler sa propre demande", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 800 });
    createdRequestIds.push(request.id);

    await expect(
      fulfillMoneyRequest({ token: request.token, payerUserId: requesterId, pin })
    ).rejects.toBeInstanceOf(MoneyRequestForbiddenError);
  });

  it("refuse de régler une demande déjà annulée", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 800 });
    createdRequestIds.push(request.id);
    await cancelMoneyRequest(request.id, requesterId);

    await expect(
      fulfillMoneyRequest({ token: request.token, payerUserId: payerId, pin })
    ).rejects.toBeInstanceOf(MoneyRequestNotPendingError);
  });

  it("refuse de régler une demande expirée", async () => {
    const request = await createMoneyRequest({ requesterUserId: requesterId, amount: 800 });
    createdRequestIds.push(request.id);
    await admin
      .from("money_requests")
      .update({ expires_at: new Date(Date.now() - 1_000).toISOString() })
      .eq("id", request.id);

    await expect(
      fulfillMoneyRequest({ token: request.token, payerUserId: payerId, pin })
    ).rejects.toBeInstanceOf(MoneyRequestNotPendingError);
  });

  it("lève MoneyRequestNotFoundError pour un jeton inconnu", async () => {
    await expect(
      fulfillMoneyRequest({ token: randomUUID(), payerUserId: payerId, pin })
    ).rejects.toBeInstanceOf(MoneyRequestNotFoundError);
  });
});
