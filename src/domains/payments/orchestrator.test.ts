import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/domains/identity/pin";
import { runPaymentOrchestrator, OrchestratorError } from "./orchestrator";
import type { PaymentRequest } from "./orchestrator-steps/types";

/**
 * Test d'intégration de bout en bout du Payment Orchestrator contre le
 * vrai projet Supabase (identifiants chargés depuis .env.local par
 * vitest.setup.ts) et les adapters SANDBOX réels du Provider Gateway
 * (Prompt 07) — pas de mock du pipeline lui-même.
 */
describe("Payment Orchestrator (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  let recipientUserId: string;
  const testEmail = `vitest-orch-${randomUUID()}@example.test`;
  const recipientEmail = `vitest-orch-recipient-${randomUUID()}@example.test`;
  const pin = "159357";
  const createdTransactionIds: string[] = [];
  const createdLinkedAccountIds: string[] = [];

  async function linkSandboxAccount(externalReference: string) {
    const { data, error } = await admin
      .from("linked_accounts")
      .insert({
        user_id: userId,
        provider: "orange",
        external_reference: externalReference,
        capabilities: ["balance", "transfer", "receive"],
        status: "active",
        consent_status: "granted",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`linkSandboxAccount failed: ${error?.message}`);
    createdLinkedAccountIds.push(data.id);
    return data.id;
  }

  function baseRequest(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
    return {
      senderUserId: userId,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceLinkedAccountId: null,
      destinationType: "external",
      destinationLinkedAccountId: null,
      amount: 5_000,
      currency: "XOF",
      pin,
      idempotencyKey: `vitest-orch-${randomUUID()}`,
      ...overrides,
    };
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: {
        naminto_id: `vitest_orch_${randomUUID().slice(0, 8)}`,
        legal_name: "Vitest Orchestrator Test",
      },
    });
    if (error || !data.user) {
      throw new Error(`Impossible de créer l'utilisateur de test: ${error?.message}`);
    }
    userId = data.user.id;

    await admin.from("pin_credentials").insert({
      user_id: userId,
      pin_hash: await hashPin(pin),
    });

    const recipient = await admin.auth.admin.createUser({
      email: recipientEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: {
        naminto_id: `vitest_orch_rcp_${randomUUID().slice(0, 8)}`,
        legal_name: "Vitest Orchestrator Recipient",
      },
    });
    if (recipient.error || !recipient.data.user) {
      throw new Error(`Impossible de créer le destinataire de test: ${recipient.error?.message}`);
    }
    recipientUserId = recipient.data.user.id;
  });

  afterAll(async () => {
    if (createdTransactionIds.length > 0) {
      await admin.from("transactions").delete().in("id", createdTransactionIds);
    }
    if (createdLinkedAccountIds.length > 0) {
      await admin.from("linked_accounts").delete().in("id", createdLinkedAccountIds);
    }
    if (recipientUserId) {
      await admin.auth.admin.deleteUser(recipientUserId);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("chemin nominal : portefeuille → compte lié externe, se règle avec le fournisseur SANDBOX réel", async () => {
    const linkedAccountId = await linkSandboxAccount(`+22507${randomUUID().slice(0, 8)}`);
    const request = baseRequest({
      sourceType: "linked_account",
      sourceLinkedAccountId: linkedAccountId,
      destinationType: "external",
    });

    const { transaction, replayed } = await runPaymentOrchestrator(request);
    createdTransactionIds.push(transaction.id);

    expect(replayed).toBe(false);
    expect(transaction.status).toBe("settled");
    expect(transaction.provider_transaction_id).toMatch(/^orange_/);
    expect(Number(transaction.fee)).toBeCloseTo(175); // 5000 * 3.5%

    // Relit depuis la base (pas seulement la valeur renvoyée en mémoire)
    // pour prouver que provider_transaction_id est bien persisté.
    const { data: persisted } = await admin
      .from("transactions")
      .select("provider_transaction_id")
      .eq("id", transaction.id)
      .single();
    expect(persisted?.provider_transaction_id).toBe(transaction.provider_transaction_id);

    const { data: events } = await admin
      .from("transaction_status_events")
      .select("to_status")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: true });
    expect(events?.map((e) => e.to_status)).toEqual([
      "created",
      "validating",
      "authentication_required",
      "authenticated",
      "processing",
      "provider_confirmed",
      "settled",
    ]);
  });

  it("portefeuille → portefeuille (naminto-to-naminto) : aucun fournisseur appelé, routing court-circuité", async () => {
    const request = baseRequest({
      sourceType: "naminto_wallet",
      destinationType: "naminto_wallet",
      recipientUserId,
      amount: 2_000,
    });

    const { transaction, replayed } = await runPaymentOrchestrator(request);
    createdTransactionIds.push(transaction.id);

    expect(replayed).toBe(false);
    expect(transaction.status).toBe("settled");
    expect(transaction.provider_transaction_id).toBeNull();
    expect(transaction.recipient_user_id).toBe(recipientUserId);
  });

  it("VALIDATION_ERROR : montant invalide, aucune transaction créée", async () => {
    const request = baseRequest({ amount: 0 });

    await expect(runPaymentOrchestrator(request)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    } satisfies Partial<OrchestratorError>);

    const { data } = await admin
      .from("transactions")
      .select("id")
      .eq("idempotency_key", request.idempotencyKey)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("AUTH_ERROR : mauvais PIN, la transaction se termine en cancelled", async () => {
    const request = baseRequest({ pin: "000000" });

    let caught: unknown;
    try {
      await runPaymentOrchestrator(request);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OrchestratorError);
    expect((caught as OrchestratorError).code).toBe("AUTH_ERROR");

    const { data: tx } = await admin
      .from("transactions")
      .select("id, status")
      .eq("idempotency_key", request.idempotencyKey)
      .single();
    if (tx) createdTransactionIds.push(tx.id);
    expect(tx?.status).toBe("cancelled");
  });

  it("COMPLIANCE_REJECTION : montant au-delà du seuil KYC sans compte vérifié", async () => {
    const request = baseRequest({ amount: 250_000 });

    let caught: unknown;
    try {
      await runPaymentOrchestrator(request);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OrchestratorError);
    expect((caught as OrchestratorError).code).toBe("COMPLIANCE_REJECTION");

    const { data: tx } = await admin
      .from("transactions")
      .select("id, status")
      .eq("idempotency_key", request.idempotencyKey)
      .single();
    if (tx) createdTransactionIds.push(tx.id);
    expect(tx?.status).toBe("failed");
  });

  it("PROVIDER_ERROR : solde SANDBOX insuffisant, la transaction se termine en failed", async () => {
    const linkedAccountId = await linkSandboxAccount(`+22508${randomUUID().slice(0, 8)}`);

    // Le solde de départ SANDBOX est 250 000. On le fait d'abord passer
    // sous le seuil de conformité renforcée (200 000) avec un premier
    // virement réussi, pour isoler le PROVIDER_ERROR du COMPLIANCE_REJECTION
    // (au-delà de 200 000 sans compte vérifié, voir orchestrator-steps/compliance.ts).
    const draining = await runPaymentOrchestrator(
      baseRequest({
        sourceType: "linked_account",
        sourceLinkedAccountId: linkedAccountId,
        destinationType: "external",
        amount: 180_000,
      })
    );
    createdTransactionIds.push(draining.transaction.id);
    expect(draining.transaction.status).toBe("settled");

    // Solde restant ≈ 250 000 - 180 000 - frais (3,5 %) ≈ 63 700.
    // On demande 100 000 : sous le seuil de conformité, mais au-dessus
    // du solde restant.
    const request = baseRequest({
      sourceType: "linked_account",
      sourceLinkedAccountId: linkedAccountId,
      destinationType: "external",
      amount: 100_000,
    });

    let caught: unknown;
    try {
      await runPaymentOrchestrator(request);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OrchestratorError);
    expect((caught as OrchestratorError).code).toBe("PROVIDER_ERROR");

    const { data: tx } = await admin
      .from("transactions")
      .select("id, status")
      .eq("idempotency_key", request.idempotencyKey)
      .single();
    if (tx) createdTransactionIds.push(tx.id);
    expect(tx?.status).toBe("failed");
  });

  it("retries sûrs : rejouer la même idempotencyKey après règlement ne réexécute aucune étape", async () => {
    const linkedAccountId = await linkSandboxAccount(`+22509${randomUUID().slice(0, 8)}`);
    const request = baseRequest({
      sourceType: "linked_account",
      sourceLinkedAccountId: linkedAccountId,
      destinationType: "external",
      amount: 1_000,
    });

    const first = await runPaymentOrchestrator(request);
    createdTransactionIds.push(first.transaction.id);
    expect(first.replayed).toBe(false);

    const second = await runPaymentOrchestrator(request);
    expect(second.replayed).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);

    const { data: events } = await admin
      .from("transaction_status_events")
      .select("to_status")
      .eq("transaction_id", first.transaction.id);
    // Une seule séquence de transitions malgré les deux appels.
    expect(events).toHaveLength(7);
  });
});
