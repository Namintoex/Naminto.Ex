import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchDueDeliveries, retryDeliveryNow } from "./dispatch";

/**
 * Test d'intégration contre le vrai projet Supabase de Naminto.Ex.
 * Construit directement une livraison vouée à l'échec (payload
 * NotificationRequested sans `transaction` — provoque une exception
 * réelle dans le consumer réel `notification-engine`, jamais simulée)
 * pour vérifier retry/backoff/dead-letter/tracing sans dépendre du
 * comportement du Notification Engine lui-même.
 */
describe("event-bus — dispatch (retry, dead-letter, tracing — intégration)", () => {
  const admin = createAdminClient();
  const eventIds: string[] = [];

  async function createBrokenDelivery() {
    const { data: event, error: eventError } = await admin
      .from("domain_events")
      .insert({ type: "NotificationRequested", correlation_id: randomUUID(), payload: { kind: "settled" } })
      .select("id")
      .single();
    if (eventError || !event) throw new Error(`Setup échoué: ${eventError?.message}`);
    eventIds.push(event.id);

    const { data: delivery, error: deliveryError } = await admin
      .from("event_deliveries")
      .insert({ event_id: event.id, consumer: "notification-engine" })
      .select("*")
      .single();
    if (deliveryError || !delivery) throw new Error(`Setup échoué: ${deliveryError?.message}`);
    return delivery;
  }

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
  });

  it("une livraison en échec passe en 'failed' avec un backoff, et journalise une tentative tracée", async () => {
    const delivery = await createBrokenDelivery();

    const summary = await dispatchDueDeliveries();
    expect(summary.checked).toBeGreaterThanOrEqual(1);

    const { data: row } = await admin.from("event_deliveries").select("*").eq("id", delivery.id).single();
    expect(row?.status).toBe("failed");
    expect(row?.attempts).toBe(1);
    expect(row?.next_retry_at).toBeTruthy();
    expect(row?.last_error).toBeTruthy();

    const { data: attempts } = await admin
      .from("event_delivery_attempts")
      .select("*")
      .eq("delivery_id", delivery.id)
      .order("attempt_number", { ascending: true });
    expect(attempts).toHaveLength(1);
    expect(attempts?.[0]).toMatchObject({ attempt_number: 1, outcome: "failed" });
    expect(attempts?.[0].finished_at).toBeTruthy();
  });

  it("passe en dead-letter après le nombre maximal de tentatives, chacune tracée individuellement", async () => {
    const delivery = await createBrokenDelivery();

    // Force chaque tentative à être immédiatement due (le vrai backoff est de plusieurs secondes).
    for (let i = 0; i < 5; i++) {
      await admin.from("event_deliveries").update({ next_retry_at: null }).eq("id", delivery.id);
      await dispatchDueDeliveries();
    }

    const { data: row } = await admin.from("event_deliveries").select("*").eq("id", delivery.id).single();
    expect(row?.status).toBe("dead_letter");
    expect(row?.attempts).toBe(5);
    expect(row?.next_retry_at).toBeNull();

    const { data: attempts } = await admin
      .from("event_delivery_attempts")
      .select("attempt_number")
      .eq("delivery_id", delivery.id)
      .order("attempt_number", { ascending: true });
    expect(attempts?.map((a) => a.attempt_number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("retryDeliveryNow donne une seule tentative supplémentaire à une livraison en dead-letter, puis y retourne en cas de nouvel échec", async () => {
    const delivery = await createBrokenDelivery();
    for (let i = 0; i < 5; i++) {
      await admin.from("event_deliveries").update({ next_retry_at: null }).eq("id", delivery.id);
      await dispatchDueDeliveries();
    }
    const { data: deadLettered } = await admin.from("event_deliveries").select("status").eq("id", delivery.id).single();
    expect(deadLettered?.status).toBe("dead_letter");

    const result = await retryDeliveryNow(delivery.id);
    expect(result).toEqual({ ok: true });

    const { data: row } = await admin.from("event_deliveries").select("*").eq("id", delivery.id).single();
    expect(row?.status).toBe("dead_letter"); // toujours en échec, mais une seule tentative de plus, pas un budget reparti de zéro
    expect(row?.attempts).toBe(6);
  });

  it("refuse de rejouer une livraison qui n'est ni 'failed' ni 'dead_letter'", async () => {
    const delivery = await createBrokenDelivery(); // status: pending
    const result = await retryDeliveryNow(delivery.id);
    expect(result).toEqual({ ok: false, error: "admin.eventBus.error.notRetryable" });
  });

  it("refuse un identifiant de livraison inconnu", async () => {
    const result = await retryDeliveryNow(randomUUID());
    expect(result).toEqual({ ok: false, error: "admin.eventBus.error.notFound" });
  });
});
