import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DomainEventType, EventDeliveryStatus } from "@/lib/supabase/database.types";
import type { EventDeliveryRow } from "./types";

const PAGE_SIZE = 25;

export interface AdminEventDeliveryRow extends EventDeliveryRow {
  eventType: DomainEventType;
  correlationId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface AdminEventDeliveryFilters {
  status?: EventDeliveryStatus;
  type?: DomainEventType;
}

export interface AdminListEventDeliveriesResult {
  deliveries: AdminEventDeliveryRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Back Office — Event Bus (Prompt 26). Lecture seule sur les livraisons (unité actionnable — pas les événements bruts). */
export async function adminListEventDeliveries(
  filters: AdminEventDeliveryFilters = {},
  page = 1
): Promise<AdminListEventDeliveriesResult> {
  const admin = createAdminClient();

  let eventIds: string[] | null = null;
  if (filters.type) {
    const { data: events } = await admin.from("domain_events").select("id").eq("type", filters.type);
    eventIds = (events ?? []).map((e) => e.id);
    if (eventIds.length === 0) {
      return { deliveries: [], total: 0, page: Math.max(1, page), pageSize: PAGE_SIZE };
    }
  }

  let query = admin.from("event_deliveries").select("*", { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  if (eventIds) query = query.in("event_id", eventIds);

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  const deliveries = data ?? [];

  const uniqueEventIds = [...new Set(deliveries.map((d) => d.event_id))];
  const { data: events } =
    uniqueEventIds.length > 0
      ? await admin.from("domain_events").select("id, type, correlation_id, payload, occurred_at").in("id", uniqueEventIds)
      : { data: [] };
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));

  return {
    deliveries: deliveries.map((d) => {
      const event = eventById.get(d.event_id);
      return {
        ...d,
        eventType: event?.type ?? ("TransactionCreated" as DomainEventType),
        correlationId: event?.correlation_id ?? "",
        payload: event?.payload ?? {},
        occurredAt: event?.occurred_at ?? d.created_at,
      };
    }),
    total: count ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

export interface EventDeliveryCounts {
  pending: number;
  failed: number;
  deadLetter: number;
}

export async function adminEventDeliveryCounts(): Promise<EventDeliveryCounts> {
  const admin = createAdminClient();
  const [pending, failed, deadLetter] = await Promise.all([
    admin.from("event_deliveries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("event_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("event_deliveries").select("id", { count: "exact", head: true }).eq("status", "dead_letter"),
  ]);
  return { pending: pending.count ?? 0, failed: failed.count ?? 0, deadLetter: deadLetter.count ?? 0 };
}
