import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "./publish";

/**
 * Test d'intégration contre le vrai projet Supabase de Naminto.Ex.
 * `NotificationRequested` est le seul événement avec un consumer réel
 * enregistré (notification-engine) — utilisé ici pour vérifier à la
 * fois publishEvent (écriture + dispatch immédiat) et l'idempotence
 * exigée par le Prompt 26 (« chaque consumer doit être idempotent »).
 */
describe("event-bus — publishEvent (intégration)", () => {
  const admin = createAdminClient();
  const eventIds: string[] = [];
  let senderId: string;
  const senderEmail = `vitest-eventbus-${randomUUID()}@example.test`;

  function fakeTransaction(overrides: Record<string, unknown> = {}) {
    return {
      sender_user_id: senderId,
      recipient_user_id: null,
      destination_type: "external",
      reference: `NEX-EVTBUS${randomUUID().slice(0, 8).toUpperCase()}`,
      amount: 1000,
      currency: "XOF",
      ...overrides,
    };
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: senderEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_evtbus_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Event Bus" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    senderId = data.user.id;
  });

  afterAll(async () => {
    if (eventIds.length > 0) {
      const { data: deliveries } = await admin.from("event_deliveries").select("id").in("event_id", eventIds);
      const deliveryIds = (deliveries ?? []).map((d) => d.id);
      if (deliveryIds.length > 0) {
        await admin.from("event_delivery_attempts").delete().in("delivery_id", deliveryIds);
        await admin.from("event_deliveries").delete().in("id", deliveryIds);
      }
      await admin.from("domain_events").delete().in("id", eventIds);
    }
    if (senderId) await admin.auth.admin.deleteUser(senderId);
  });

  it("écrit un événement avec le bon type/correlationId/payload", async () => {
    const correlationId = randomUUID();
    const eventId = await publishEvent("RiskDecisionMade", { level: "LOW" }, correlationId);
    expect(eventId).toBeTruthy();
    if (eventId) eventIds.push(eventId);

    const { data: row } = await admin.from("domain_events").select("*").eq("id", eventId!).single();
    expect(row?.type).toBe("RiskDecisionMade");
    expect(row?.correlation_id).toBe(correlationId);
    expect(row?.payload).toMatchObject({ level: "LOW" });
  });

  it("un type d'événement sans consumer enregistré ne crée aucune livraison", async () => {
    const eventId = await publishEvent("TransactionCreated", { reference: "NEX-EVTBUS0" }, randomUUID());
    if (eventId) eventIds.push(eventId);

    const { count } = await admin
      .from("event_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId!);
    expect(count).toBe(0);
  });

  it("NotificationRequested crée une livraison et la traite immédiatement avec succès", async () => {
    const tx = fakeTransaction();
    const eventId = await publishEvent("NotificationRequested", { kind: "settled", transaction: tx }, senderId);
    if (eventId) eventIds.push(eventId);

    const { data: delivery } = await admin
      .from("event_deliveries")
      .select("*")
      .eq("event_id", eventId!)
      .eq("consumer", "notification-engine")
      .single();
    expect(delivery?.status).toBe("succeeded");
    expect(delivery?.attempts).toBe(1);

    const { data: notif } = await admin
      .from("notifications")
      .select("id")
      .eq("event_type", "transaction_settled")
      .contains("metadata", { reference: tx.reference })
      .maybeSingle();
    expect(notif).toBeTruthy();
  });

  it("un deuxième NotificationRequested pour la même transaction ne recrée jamais la notification (idempotence du consumer)", async () => {
    const tx = fakeTransaction();

    const firstEventId = await publishEvent("NotificationRequested", { kind: "settled", transaction: tx }, senderId);
    if (firstEventId) eventIds.push(firstEventId);
    const secondEventId = await publishEvent("NotificationRequested", { kind: "settled", transaction: tx }, senderId);
    if (secondEventId) eventIds.push(secondEventId);

    const { data: secondDelivery } = await admin
      .from("event_deliveries")
      .select("status")
      .eq("event_id", secondEventId!)
      .eq("consumer", "notification-engine")
      .single();
    expect(secondDelivery?.status).toBe("succeeded"); // no-op réussi, pas une erreur

    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "transaction_settled")
      .contains("metadata", { reference: tx.reference });
    expect(count).toBe(1); // jamais deux notifications pour la même transaction
  });
});
