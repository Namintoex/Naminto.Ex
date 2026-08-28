import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction, transitionTransaction } from "@/domains/payments/transactions";
import { signSandboxWebhook } from "@/domains/providers/sandbox/webhook-signature";
import { processIncomingWebhook } from "./process-webhook";

/**
 * Test d'intégration contre le vrai projet Supabase de Naminto.Ex.
 * Chaque cas construit un payload réellement signé (signSandboxWebhook)
 * — jamais une signature simulée — pour vérifier le pipeline complet
 * (signature → forme → fraîcheur → idempotence → ordre → corrélation).
 */
describe("webhooks — processIncomingWebhook (intégration)", () => {
  const admin = createAdminClient();
  const insertedRowIds: string[] = [];
  const createdTransactionIds: string[] = [];

  function payload(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      type: "transfer.confirmed",
      event_id: `evt-${randomUUID()}`,
      occurred_at: new Date().toISOString(),
      status: "confirmed",
      ...overrides,
    });
  }

  async function run(rawPayload: string, signature: string | null) {
    const result = await processIncomingWebhook("orange", rawPayload, signature);
    if (result.eventRowId) insertedRowIds.push(result.eventRowId);
    return result;
  }

  afterAll(async () => {
    if (insertedRowIds.length > 0) await admin.from("webhook_events").delete().in("id", insertedRowIds);
    if (createdTransactionIds.length > 0) await admin.from("transactions").delete().in("id", createdTransactionIds);
  });

  it("accepte un webhook correctement signé et récent — status processed, httpStatus 200", async () => {
    const body = payload();
    const result = await run(body, signSandboxWebhook(body));
    expect(result).toMatchObject({ httpStatus: 200, status: "processed" });

    const { data: row } = await admin.from("webhook_events").select("*").eq("id", result.eventRowId!).single();
    expect(row?.signature_valid).toBe(true);
    expect(row?.provider).toBe("orange");
  });

  it("rejette une signature absente — httpStatus 401, audité malgré tout", async () => {
    const body = payload();
    const result = await run(body, null);
    expect(result).toMatchObject({ httpStatus: 401, status: "rejected", reason: "missing_signature" });

    const { data: row } = await admin.from("webhook_events").select("signature_valid").eq("id", result.eventRowId!).single();
    expect(row?.signature_valid).toBe(false);
  });

  it("rejette une signature falsifiée — httpStatus 401", async () => {
    const body = payload();
    const result = await run(body, "t=1,v1=" + "0".repeat(64));
    expect(result).toMatchObject({ httpStatus: 401, status: "rejected", reason: "invalid_signature" });
  });

  it("rejette un payload correctement signé mais malformé — httpStatus 400", async () => {
    const body = "not-json-at-all";
    const result = await run(body, signSandboxWebhook(body));
    expect(result).toMatchObject({ httpStatus: 400, status: "rejected", reason: "invalid_payload" });
  });

  it("rejette un événement trop ancien (fenêtre anti-rejeu) — httpStatus 200, reason stale_replay", async () => {
    const body = payload({ occurred_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
    const result = await run(body, signSandboxWebhook(body));
    expect(result).toMatchObject({ httpStatus: 200, status: "rejected", reason: "stale_replay" });
  });

  it("détecte une duplication : le même event_id renvoyé une seconde fois devient duplicate, jamais retraité", async () => {
    const eventId = `evt-${randomUUID()}`;
    const body = payload({ event_id: eventId });

    const first = await run(body, signSandboxWebhook(body));
    expect(first.status).toBe("processed");

    const second = await run(body, signSandboxWebhook(body));
    expect(second).toMatchObject({ httpStatus: 200, status: "duplicate" });

    const { count } = await admin
      .from("webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    expect(count).toBe(2); // les deux tentatives restent auditées, la seconde n'a rien retraité
  });

  it("détecte un événement hors ordre pour la même transaction fournisseur", async () => {
    const providerTransactionId = `orange_${randomUUID()}`;
    const first = payload({
      occurred_at: new Date().toISOString(),
      provider_transaction_id: providerTransactionId,
    });
    const firstResult = await run(first, signSandboxWebhook(first));
    expect(firstResult.status).toBe("processed");

    const older = payload({
      event_id: `evt-${randomUUID()}`,
      occurred_at: new Date(Date.now() - 30 * 1000).toISOString(),
      provider_transaction_id: providerTransactionId,
    });
    const olderResult = await run(older, signSandboxWebhook(older));
    expect(olderResult).toMatchObject({ httpStatus: 200, status: "rejected", reason: "out_of_order" });
  });

  it("corrèle l'événement à la transaction Naminto.Ex correspondante quand elle existe", async () => {
    const tx = await createTransaction({
      senderUserId: null,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: "orange",
      amount: 1_000,
      idempotencyKey: `vitest-webhook-corr-${randomUUID()}`,
    });
    createdTransactionIds.push(tx.id);
    const providerTransactionId = `orange_${randomUUID()}`;
    await transitionTransaction(tx.id, "validating");
    await transitionTransaction(tx.id, "authentication_required");
    await transitionTransaction(tx.id, "authenticated");
    await transitionTransaction(tx.id, "processing");
    await transitionTransaction(tx.id, "provider_confirmed", undefined, { providerTransactionId });

    const body = payload({ provider_transaction_id: providerTransactionId });
    const result = await run(body, signSandboxWebhook(body));
    expect(result.status).toBe("processed");

    const { data: row } = await admin.from("webhook_events").select("transaction_id").eq("id", result.eventRowId!).single();
    expect(row?.transaction_id).toBe(tx.id);
  });
});
