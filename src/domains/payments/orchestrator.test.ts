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
      destinationExternalReference: "+225070000001",
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
      // ledger_entries est append-only, même pour service_role (voir
      // 0008_ledger.sql) — une transaction réglée pendant le test garde
      // définitivement ses écritures, comme en production. On ne peut
      // donc supprimer ici que les transactions qui n'ont jamais été
      // réglées (aucune écriture Ledger associée).
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
    // pour prouver que provider_transaction_id et la référence du
    // bénéficiaire externe (Send Money, Prompt 13) sont bien persistés.
    const { data: persisted } = await admin
      .from("transactions")
      .select("provider_transaction_id, destination_external_reference")
      .eq("id", transaction.id)
      .single();
    expect(persisted?.provider_transaction_id).toBe(transaction.provider_transaction_id);
    expect(persisted?.destination_external_reference).toBe(request.destinationExternalReference);

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

  it("feePayerOverride (Send Money, Prompt 13) est propagé jusqu'au Fee Engine et persisté", async () => {
    const request = baseRequest({
      sourceType: "naminto_wallet",
      destinationType: "naminto_wallet",
      recipientUserId,
      amount: 2_000,
      feePayerOverride: "recipient",
    });

    const { transaction } = await runPaymentOrchestrator(request);
    createdTransactionIds.push(transaction.id);

    expect(transaction.fee_payer).toBe("recipient");
  });

  it("VALIDATION_ERROR : destinataire externe sans référence, aucune transaction créée", async () => {
    const request = baseRequest({ destinationExternalReference: null });

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

  it("rejouer la même idempotencyKey après un échec terminal (AUTH_ERROR) ne renvoie jamais un faux succès", async () => {
    const idempotencyKey = `vitest-orch-${randomUUID()}`;
    const failedAttempt = baseRequest({ pin: "000000", idempotencyKey });

    let firstError: unknown;
    try {
      await runPaymentOrchestrator(failedAttempt);
    } catch (err) {
      firstError = err;
    }
    expect((firstError as OrchestratorError).code).toBe("AUTH_ERROR");

    const { data: tx } = await admin
      .from("transactions")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .single();
    if (tx) createdTransactionIds.push(tx.id);
    expect(tx?.status).toBe("cancelled");

    // Rejeu avec la MÊME idempotencyKey, cette fois avec le bon PIN — ne
    // doit jamais silencieusement renvoyer `replayed: true` (un succès
    // mensonger pour une tentative dont le PIN précédent était faux et
    // dont aucun transfert n'a jamais réellement eu lieu). Corrige un bug
    // trouvé en revue de code : `!isInFlight(status)` seul est vrai pour
    // tout statut terminal, y compris un échec.
    let secondError: unknown;
    try {
      await runPaymentOrchestrator(baseRequest({ idempotencyKey }));
    } catch (err) {
      secondError = err;
    }
    expect(secondError).toBeInstanceOf(OrchestratorError);
    expect((secondError as OrchestratorError).code).toBe("SYSTEM_ERROR");
    expect((secondError as OrchestratorError).details?.status).toBe("cancelled");
  });

  it("RISK_REJECTION : montant au-delà du seuil HIGH du Risk Engine, la transaction se termine en failed", async () => {
    const request = baseRequest({ amount: 500_001 });

    let caught: unknown;
    try {
      await runPaymentOrchestrator(request);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OrchestratorError);
    expect((caught as OrchestratorError).code).toBe("RISK_REJECTION");
    expect((caught as OrchestratorError).details?.reasons).toBeDefined();

    const { data: tx } = await admin
      .from("transactions")
      .select("id, status")
      .eq("idempotency_key", request.idempotencyKey)
      .single();
    if (tx) createdTransactionIds.push(tx.id);
    expect(tx?.status).toBe("failed");
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

  it("LIMIT_ERROR : refusé par une règle du Limit Engine, la transaction se termine en failed", async () => {
    const { data: rule, error } = await admin
      .from("limit_rules")
      .insert({ limit_type: "per_transaction_amount", max_amount: 1_000, currency: "XOF" })
      .select("id")
      .single();
    if (error || !rule) throw new Error(`Setup de la règle de test échoué: ${error?.message}`);

    try {
      const request = baseRequest({ amount: 2_000 });

      let caught: unknown;
      try {
        await runPaymentOrchestrator(request);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(OrchestratorError);
      expect((caught as OrchestratorError).code).toBe("LIMIT_ERROR");

      const { data: tx } = await admin
        .from("transactions")
        .select("id, status")
        .eq("idempotency_key", request.idempotencyKey)
        .single();
      if (tx) createdTransactionIds.push(tx.id);
      expect(tx?.status).toBe("failed");
    } finally {
      await admin.from("limit_rules").delete().eq("id", rule.id);
    }
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
    // 60s : ce test enchaîne deux règlements orchestrateur complets (le
    // premier RÉELLEMENT settled — Ledger, notification, réconciliation
    // inclus) contre le vrai projet Supabase ; déjà marginal sur son
    // budget de 30s par défaut avant ce prompt (même nature que
    // FRAUD_BLOCKED, voir le commentaire de ce test), et les correctifs
    // de cette revue de code (withTimeout, filtre provider du Limit
    // Engine, idempotence par destinataire des notifications) ajoutent
    // chacun un aller-retour réseau supplémentaire.
  }, 60_000);

  it("MANUAL_REVIEW_REQUIRED : plusieurs signaux de risque modérés combinés (Fraud Engine, Prompt 18)", async () => {
    // Utilisateur dédié : le montant ciblé (150 000, nouveau bénéficiaire,
    // compte neuf) doit produire au moins trois signaux Risk MEDIUM
    // (amount, history, beneficiary) sans dépendre de l'historique déjà
    // accumulé par le `userId` partagé du describe.
    const email = `vitest-orch-fraud-review-${randomUUID()}@example.test`;
    const user = await admin.auth.admin.createUser({
      email,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_orch_frr_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Fraud Review" },
    });
    if (user.error || !user.data.user) throw new Error(`Impossible de créer l'utilisateur: ${user.error?.message}`);
    const freshUserId = user.data.user.id;
    await admin.from("pin_credentials").insert({ user_id: freshUserId, pin_hash: await hashPin(pin) });

    try {
      const request = baseRequest({
        senderUserId: freshUserId,
        sourceType: "naminto_wallet",
        destinationType: "naminto_wallet",
        destinationExternalReference: null,
        recipientUserId,
        amount: 150_000,
      });

      let caught: unknown;
      try {
        await runPaymentOrchestrator(request);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(OrchestratorError);
      expect((caught as OrchestratorError).code).toBe("MANUAL_REVIEW_REQUIRED");
      expect((caught as OrchestratorError).details?.matchedRules).toBeDefined();

      const { data: tx } = await admin
        .from("transactions")
        .select("id, status")
        .eq("idempotency_key", request.idempotencyKey)
        .single();
      if (tx) createdTransactionIds.push(tx.id);
      expect(tx?.status).toBe("failed");
    } finally {
      await admin.auth.admin.deleteUser(freshUserId);
    }
  });

  it("FRAUD_BLOCKED : plusieurs opérations rapprochées avec des montants non négligeables (Fraud Engine, Prompt 18)", async () => {
    const email = `vitest-orch-fraud-block-${randomUUID()}@example.test`;
    const user = await admin.auth.admin.createUser({
      email,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_orch_frb_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Fraud Block" },
    });
    if (user.error || !user.data.user) throw new Error(`Impossible de créer l'utilisateur: ${user.error?.message}`);
    const freshUserId = user.data.user.id;
    await admin.from("pin_credentials").insert({ user_id: freshUserId, pin_hash: await hashPin(pin) });

    const localCreatedTransactionIds: string[] = [];
    try {
      // Construit une fréquence MEDIUM (>= 5 opérations sur la dernière
      // heure — voir docs/DECISIONS.md ADR-045) en réglant directement
      // via runPaymentOrchestrator plutôt qu'en manipulant transactions.ts
      // à la main, pour rester représentatif d'un usage réel.
      for (let i = 0; i < 5; i += 1) {
        const { transaction } = await runPaymentOrchestrator(
          baseRequest({
            senderUserId: freshUserId,
            sourceType: "naminto_wallet",
            destinationType: "naminto_wallet",
            destinationExternalReference: null,
            recipientUserId,
            amount: 500,
          })
        );
        localCreatedTransactionIds.push(transaction.id);
      }

      const request = baseRequest({
        senderUserId: freshUserId,
        sourceType: "naminto_wallet",
        destinationType: "naminto_wallet",
        destinationExternalReference: null,
        recipientUserId,
        amount: 150_000,
      });

      let caught: unknown;
      try {
        await runPaymentOrchestrator(request);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(OrchestratorError);
      expect((caught as OrchestratorError).code).toBe("FRAUD_BLOCKED");

      const { data: tx } = await admin
        .from("transactions")
        .select("id, status")
        .eq("idempotency_key", request.idempotencyKey)
        .single();
      if (tx) localCreatedTransactionIds.push(tx.id);
      expect(tx?.status).toBe("failed");
    } finally {
      // Les 5 opérations réglées ont des écritures Ledger réelles
      // (append-only, ADR-038) — jamais supprimées. Seule la dernière
      // (bloquée, sans écriture) est nettoyable.
      const { data: settledEntries } = await admin
        .from("ledger_entries")
        .select("transaction_id")
        .in("transaction_id", localCreatedTransactionIds);
      const settledIds = new Set((settledEntries ?? []).map((e) => e.transaction_id));
      const deletableIds = localCreatedTransactionIds.filter((id) => !settledIds.has(id));
      if (deletableIds.length > 0) {
        await admin.from("transactions").delete().in("id", deletableIds);
      }
      await admin.auth.admin.deleteUser(freshUserId);
    }
    // 90s : les 5 règlements déclenchent désormais un envoi de
    // notification réel (Prompt 20, plus le STUB instantané d'avant) sur
    // trois canaux chacun — davantage d'aller-retours réseau vers le
    // vrai projet Supabase que ce test n'en avait au départ. Prompt 28
    // (ADR-056) ajoute encore un aller-retour par règlement (réclamation
    // atomique `ledger_settlement_claims`, nécessaire pour fermer une
    // race condition réelle) — 76 s observées en isolation, marge portée
    // à 150 s pour absorber la contention d'une suite complète.
  }, 150_000);

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
