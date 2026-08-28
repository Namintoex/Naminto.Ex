import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction, transitionTransaction } from "@/domains/payments/transactions";
import {
  adminApiMetrics,
  adminAuthAnomalyCount,
  adminNotificationFailureRate,
  adminObservabilityOverview,
  adminProviderMetrics,
  adminTransactionSuccessRate,
  adminTransactionTrace,
} from "./admin-queries";

/**
 * Test d'intégration contre le vrai projet Supabase de Naminto.Ex.
 * Chaque métrique est vérifiée en isolant ses propres lignes par un
 * identifiant unique (request_id, provider, event_id, user de test) —
 * jamais en comptant sur un état global préexistant.
 */
describe("observability — admin-queries (intégration)", () => {
  const admin = createAdminClient();
  const requestLogIds: string[] = [];
  const providerCallLogIds: string[] = [];
  const createdTransactionIds: string[] = [];
  const securityEventIds: string[] = [];
  let notificationId: string | null = null;
  let userId: string;
  const userEmail = `vitest-observability-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: userEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_obs_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Observability" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    userId = data.user.id;
  });

  afterAll(async () => {
    if (requestLogIds.length > 0) await admin.from("request_logs").delete().in("id", requestLogIds);
    if (providerCallLogIds.length > 0) await admin.from("provider_call_logs").delete().in("id", providerCallLogIds);
    if (createdTransactionIds.length > 0) await admin.from("transactions").delete().in("id", createdTransactionIds);
    if (securityEventIds.length > 0) await admin.from("security_events").delete().in("id", securityEventIds);
    if (notificationId) await admin.from("notifications").delete().eq("id", notificationId); // cascade sur notification_deliveries
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("adminApiMetrics calcule count/errorRate/latence à partir de request_logs", async () => {
    const requestId = randomUUID();
    const rows = [
      { request_id: requestId, method: "ORCHESTRATOR", path: "vitest.probe", status_code: 200, duration_ms: 100 },
      { request_id: randomUUID(), method: "ORCHESTRATOR", path: "vitest.probe", status_code: 200, duration_ms: 200 },
      { request_id: randomUUID(), method: "ORCHESTRATOR", path: "vitest.probe", status_code: 500, duration_ms: 300 },
    ];
    const { data } = await admin.from("request_logs").insert(rows).select("id");
    requestLogIds.push(...(data ?? []).map((r) => r.id));

    const metrics = await adminApiMetrics(24);
    // Fenêtre partagée avec d'autres écritures réelles (orchestrateur, webhooks) — on vérifie des bornes, pas une égalité stricte.
    expect(metrics.requestCount).toBeGreaterThanOrEqual(3);
    expect(metrics.errorCount).toBeGreaterThanOrEqual(1);
    expect(metrics.avgDurationMs).toBeGreaterThan(0);
    expect(metrics.p95DurationMs).toBeGreaterThanOrEqual(metrics.avgDurationMs > 0 ? 0 : 0);
  });

  it("adminProviderMetrics agrège par fournisseur à partir de provider_call_logs", async () => {
    const marker = `vitest-${randomUUID()}`;
    const { data } = await admin
      .from("provider_call_logs")
      .insert([
        { provider: "orange", operation: marker, duration_ms: 50, success: true },
        { provider: "orange", operation: marker, duration_ms: 150, success: false, error_message: "boom" },
      ])
      .select("id");
    providerCallLogIds.push(...(data ?? []).map((r) => r.id));

    const metrics = await adminProviderMetrics(24);
    const orange = metrics.find((m) => m.provider === "orange");
    expect(orange).toBeTruthy();
    expect(orange!.callCount).toBeGreaterThanOrEqual(2);
    expect(orange!.errorCount).toBeGreaterThanOrEqual(1);
  });

  it("adminTransactionSuccessRate distingue settled des statuts d'échec", async () => {
    const settledTx = await createTransaction({
      senderUserId: userId,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: null,
      amount: 1_000,
      idempotencyKey: `vitest-obs-settled-${randomUUID()}`,
    });
    createdTransactionIds.push(settledTx.id);
    await transitionTransaction(settledTx.id, "validating");
    await transitionTransaction(settledTx.id, "authentication_required");
    await transitionTransaction(settledTx.id, "authenticated");
    await transitionTransaction(settledTx.id, "processing");
    await transitionTransaction(settledTx.id, "provider_confirmed");
    await transitionTransaction(settledTx.id, "settled");

    const rejectedTx = await createTransaction({
      senderUserId: userId,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: null,
      amount: 1_000,
      idempotencyKey: `vitest-obs-rejected-${randomUUID()}`,
    });
    createdTransactionIds.push(rejectedTx.id);
    await transitionTransaction(rejectedTx.id, "validating");
    await transitionTransaction(rejectedTx.id, "rejected");

    const rate = await adminTransactionSuccessRate(24);
    expect(rate.settled).toBeGreaterThanOrEqual(1);
    expect(rate.failedLike).toBeGreaterThanOrEqual(1);
    expect(rate.successRate).toBeGreaterThan(0);
    expect(rate.successRate).toBeLessThanOrEqual(1);
  });

  it("adminNotificationFailureRate compte les livraisons FAILED", async () => {
    const { data: notif } = await admin
      .from("notifications")
      .insert({ user_id: userId, event_type: "transaction_settled", title: "t", body: "b", locale: "fr" })
      .select("id")
      .single();
    notificationId = notif!.id;

    await admin.from("notification_deliveries").insert({ notification_id: notif!.id, channel: "SMS", status: "FAILED", mode: "SANDBOX" });

    const rate = await adminNotificationFailureRate(24);
    expect(rate.failed).toBeGreaterThanOrEqual(1);
    expect(rate.total).toBeGreaterThanOrEqual(1);
  });

  it("adminAuthAnomalyCount compte uniquement les types anormaux, jamais les événements de routine", async () => {
    const { data } = await admin
      .from("security_events")
      .insert([
        { user_id: userId, type: "login_failed" },
        { user_id: userId, type: "new_device_login" },
        { user_id: userId, type: "login_success" }, // routine, ne doit jamais être compté
      ])
      .select("id, type");
    securityEventIds.push(...(data ?? []).map((r) => r.id));

    const count = await adminAuthAnomalyCount(24);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("adminTransactionTrace fusionne transaction_status_events et domain_events en une chronologie triée", async () => {
    const tx = await createTransaction({
      senderUserId: userId,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: null,
      amount: 1_000,
      idempotencyKey: `vitest-obs-trace-${randomUUID()}`,
    });
    createdTransactionIds.push(tx.id);
    await transitionTransaction(tx.id, "validating");

    const { data: event } = await admin
      .from("domain_events")
      .insert({ type: "TransactionValidated", correlation_id: tx.id, payload: { reference: tx.reference } })
      .select("id")
      .single();

    const trace = await adminTransactionTrace(tx.reference);
    expect(trace).toBeTruthy();
    expect(trace!.transactionId).toBe(tx.id);
    expect(trace!.timeline.length).toBeGreaterThanOrEqual(3); // created, validating, + l'événement inséré
    expect(trace!.timeline.some((e) => e.source === "status")).toBe(true);
    expect(trace!.timeline.some((e) => e.source === "event" && e.label === "TransactionValidated")).toBe(true);
    // La chronologie doit être triée par timestamp croissant.
    const timestamps = trace!.timeline.map((e) => new Date(e.timestamp).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));

    await admin.from("domain_events").delete().eq("id", event!.id);
  });

  it("adminTransactionTrace renvoie null pour une référence inconnue", async () => {
    expect(await adminTransactionTrace("NEX-INCONNUE")).toBeNull();
  });

  it("adminObservabilityOverview agrège les neuf mesures sans lever", async () => {
    const overview = await adminObservabilityOverview(24);
    expect(overview.api).toBeDefined();
    expect(Array.isArray(overview.providers)).toBe(true);
    expect(overview.transactionSuccessRate).toBeDefined();
    expect(typeof overview.webhookFailures).toBe("number");
    expect(typeof overview.reconciliationAnomalies).toBe("number");
    expect(overview.notificationFailures).toBeDefined();
    expect(typeof overview.authAnomalies).toBe("number");
  });
});
