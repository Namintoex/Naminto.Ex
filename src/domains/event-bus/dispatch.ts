import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DomainEventType } from "@/lib/supabase/database.types";
import "./consumers";
import { consumersFor } from "./registry";
import type { DomainEvent, DomainEventRow, EventDeliveryRow } from "./types";

/**
 * Nombre maximal de tentatives avant dead-letter, et délai de backoff
 * exponentiel entre deux tentatives — valeurs raisonnables non
 * documentées dans les sources (même statut que REPLAY_WINDOW_MS,
 * Prompt 25). TODO_DECISION si d'autres valeurs sont requises, voir
 * docs/DECISIONS.md.
 */
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000;

type AdminClient = ReturnType<typeof createAdminClient>;

function toDomainEvent(row: DomainEventRow): DomainEvent {
  return {
    id: row.id,
    type: row.type,
    correlationId: row.correlation_id,
    payload: row.payload,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

/**
 * Traite une livraison unique : une ligne `event_delivery_attempts` par
 * tentative (exigence « tracing »), jamais une simple incrémentation de
 * compteur. Ne lève jamais — l'échec d'un consumer reste local à sa
 * propre livraison, jamais propagé (même garantie que les autres étapes
 * défensives de l'orchestrateur, Prompt 20).
 */
async function attemptDelivery(admin: AdminClient, delivery: EventDeliveryRow, eventRow: DomainEventRow): Promise<void> {
  const attemptNumber = delivery.attempts + 1;
  const { data: attemptRow } = await admin
    .from("event_delivery_attempts")
    .insert({ delivery_id: delivery.id, attempt_number: attemptNumber })
    .select("id")
    .single();

  const consumer = consumersFor(eventRow.type as DomainEventType).find((c) => c.name === delivery.consumer);
  if (!consumer) {
    // Ne devrait normalement jamais arriver (le consumer qui a créé la
    // livraison a nécessairement été enregistré) — traité en dead-letter
    // par prudence plutôt que de boucler indéfiniment sur une livraison
    // qui ne pourra jamais aboutir.
    await admin
      .from("event_deliveries")
      .update({ status: "dead_letter", attempts: attemptNumber, last_error: "consumer_not_registered" })
      .eq("id", delivery.id);
    if (attemptRow) {
      await admin
        .from("event_delivery_attempts")
        .update({ finished_at: new Date().toISOString(), outcome: "failed", error: "consumer_not_registered" })
        .eq("id", attemptRow.id);
    }
    return;
  }

  try {
    await consumer.handle(toDomainEvent(eventRow));
    await admin.from("event_deliveries").update({ status: "succeeded", attempts: attemptNumber }).eq("id", delivery.id);
    if (attemptRow) {
      await admin
        .from("event_delivery_attempts")
        .update({ finished_at: new Date().toISOString(), outcome: "succeeded" })
        .eq("id", attemptRow.id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const isFinal = attemptNumber >= MAX_ATTEMPTS;
    await admin
      .from("event_deliveries")
      .update({
        status: isFinal ? "dead_letter" : "failed",
        attempts: attemptNumber,
        last_error: message,
        next_retry_at: isFinal ? null : new Date(Date.now() + BACKOFF_BASE_MS * 2 ** (attemptNumber - 1)).toISOString(),
      })
      .eq("id", delivery.id);
    if (attemptRow) {
      await admin
        .from("event_delivery_attempts")
        .update({ finished_at: new Date().toISOString(), outcome: "failed", error: message })
        .eq("id", attemptRow.id);
    }
  }
}

/** Tentative immédiate best-effort juste après publication (voir publish.ts) — jamais bloquante, jamais levée. */
export async function dispatchDeliveriesForEvent(admin: AdminClient, eventId: string): Promise<void> {
  const { data: deliveries } = await admin.from("event_deliveries").select("*").eq("event_id", eventId).eq("status", "pending");
  if (!deliveries || deliveries.length === 0) return;

  const { data: eventRow } = await admin.from("domain_events").select("*").eq("id", eventId).maybeSingle();
  if (!eventRow) return;

  for (const delivery of deliveries) {
    await attemptDelivery(admin, delivery, eventRow);
  }
}

export type RetryDeliveryResult = { ok: true } | { ok: false; error: string };

/**
 * Rejeu contrôlé d'une livraison unique (Back Office, permission
 * event.manage) — remet `failed`/`dead_letter` à `pending` puis tente
 * immédiatement, sans réinitialiser `attempts` : une livraison déjà en
 * dead-letter (attempts = MAX_ATTEMPTS) ne reçoit ainsi qu'une seule
 * tentative supplémentaire avant d'y retourner en cas de nouvel échec,
 * jamais un budget de tentatives repartant de zéro.
 */
export async function retryDeliveryNow(deliveryId: string): Promise<RetryDeliveryResult> {
  const admin = createAdminClient();

  const { data: delivery } = await admin.from("event_deliveries").select("*").eq("id", deliveryId).maybeSingle();
  if (!delivery) return { ok: false, error: "admin.eventBus.error.notFound" };
  if (delivery.status !== "failed" && delivery.status !== "dead_letter") {
    return { ok: false, error: "admin.eventBus.error.notRetryable" };
  }

  const { data: eventRow } = await admin.from("domain_events").select("*").eq("id", delivery.event_id).maybeSingle();
  if (!eventRow) return { ok: false, error: "admin.eventBus.error.notFound" };

  await admin.from("event_deliveries").update({ status: "pending", next_retry_at: null }).eq("id", deliveryId);
  await attemptDelivery(admin, { ...delivery, status: "pending", next_retry_at: null }, eventRow);

  return { ok: true };
}

export interface DispatchSummary {
  checked: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

/**
 * Lot manuel Back Office (Prompt 26) — reprend les livraisons `pending`
 * (jamais tentées) et `failed` dont le backoff est écoulé. Aucun
 * ordonnanceur/cron n'existe dans ce dépôt (même constat que
 * Reconciliation, Prompt 24, et Webhooks, Prompt 25).
 */
export async function dispatchDueDeliveries(limit = 100): Promise<DispatchSummary> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: deliveries } = await admin
    .from("event_deliveries")
    .select("*")
    .in("status", ["pending", "failed"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  const summary: DispatchSummary = { checked: 0, succeeded: 0, failed: 0, deadLettered: 0 };
  if (!deliveries || deliveries.length === 0) return summary;

  const eventIds = [...new Set(deliveries.map((d) => d.event_id))];
  const { data: events } = await admin.from("domain_events").select("*").in("id", eventIds);
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));

  for (const delivery of deliveries) {
    const eventRow = eventById.get(delivery.event_id);
    if (!eventRow) continue;
    await attemptDelivery(admin, delivery, eventRow);
    summary.checked += 1;

    const { data: updated } = await admin.from("event_deliveries").select("status").eq("id", delivery.id).maybeSingle();
    if (updated?.status === "succeeded") summary.succeeded += 1;
    else if (updated?.status === "dead_letter") summary.deadLettered += 1;
    else summary.failed += 1;
  }

  return summary;
}
