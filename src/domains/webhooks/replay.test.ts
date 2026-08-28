import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { signSandboxWebhook } from "@/domains/providers/sandbox/webhook-signature";
import { processIncomingWebhook } from "./process-webhook";
import { adminReplayWebhookEvent } from "./replay";

describe("webhooks — adminReplayWebhookEvent (intégration)", () => {
  const admin = createAdminClient();
  const insertedRowIds: string[] = [];
  let adminUserId: string;
  const adminEmail = `vitest-webhook-replay-${randomUUID()}@example.test`;

  function payload(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      type: "transfer.confirmed",
      event_id: `evt-${randomUUID()}`,
      occurred_at: new Date().toISOString(),
      status: "confirmed",
      ...overrides,
    });
  }

  async function receive(overrides: Record<string, unknown> = {}) {
    const body = payload(overrides);
    const result = await processIncomingWebhook("orange", body, signSandboxWebhook(body));
    if (result.eventRowId) insertedRowIds.push(result.eventRowId);
    return result;
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_wh_replay_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Webhook Replay" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    adminUserId = data.user.id;
  });

  afterAll(async () => {
    if (insertedRowIds.length > 0) await admin.from("webhook_events").delete().in("id", insertedRowIds);
    if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
  });

  async function track(eventRowId: string) {
    insertedRowIds.push(eventRowId);
    return eventRowId;
  }

  it("refuse un identifiant inexistant", async () => {
    const result = await adminReplayWebhookEvent(randomUUID(), adminUserId);
    expect(result).toEqual({ ok: false, error: "admin.webhooks.error.notFound" });
  });

  it("refuse de rejouer un événement à la signature invalide", async () => {
    const body = payload();
    const rejected = await processIncomingWebhook("orange", body, null);
    await track(rejected.eventRowId!);

    const result = await adminReplayWebhookEvent(rejected.eventRowId!, adminUserId);
    expect(result).toEqual({ ok: false, error: "admin.webhooks.error.cannotReplayInvalid" });
  });

  it("rejoue un événement déjà traité comme un no-op sûr (duplicate), sans reprocessing", async () => {
    const original = await receive();
    expect(original.status).toBe("processed");

    const replay = await adminReplayWebhookEvent(original.eventRowId!, adminUserId);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    await track(replay.eventRowId);

    const { data: row } = await admin.from("webhook_events").select("*").eq("id", replay.eventRowId).single();
    expect(row?.status).toBe("duplicate");
    expect(row?.replay_of).toBe(original.eventRowId);
    expect(row?.replayed_by).toBe(adminUserId);
  });

  it("rejoue avec succès un événement initialement rejeté pour cause de fraîcheur (stale_replay), en ignorant volontairement cette fenêtre", async () => {
    const body = payload({ occurred_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
    const stale = await processIncomingWebhook("orange", body, signSandboxWebhook(body));
    await track(stale.eventRowId!);
    expect(stale.reason).toBe("stale_replay");

    const replay = await adminReplayWebhookEvent(stale.eventRowId!, adminUserId);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    await track(replay.eventRowId);

    const { data: row } = await admin.from("webhook_events").select("status").eq("id", replay.eventRowId).single();
    expect(row?.status).toBe("processed");
  });

  it("un rejeu continue de respecter la détection hors-ordre, revérifiée contre l'état actuel", async () => {
    const providerTransactionId = `orange_${randomUUID()}`;

    const newer = await receive({
      occurred_at: new Date().toISOString(),
      provider_transaction_id: providerTransactionId,
    });
    const older = await receive({
      occurred_at: new Date(Date.now() - 30 * 1000).toISOString(),
      provider_transaction_id: providerTransactionId,
    });
    expect(newer.status).toBe("processed");
    expect(older.status).toBe("rejected");

    const replay = await adminReplayWebhookEvent(older.eventRowId!, adminUserId);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    await track(replay.eventRowId);

    const { data: row } = await admin
      .from("webhook_events")
      .select("status, reject_reason")
      .eq("id", replay.eventRowId)
      .single();
    expect(row).toMatchObject({ status: "rejected", reject_reason: "out_of_order" });
  });
});
