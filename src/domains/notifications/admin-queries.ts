import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, NotificationDeliveryStatus } from "@/lib/supabase/database.types";

type DeliveryRow = Database["public"]["Tables"]["notification_deliveries"]["Row"];

const PAGE_SIZE = 25;

/**
 * Forme volontairement restreinte (Prompt 28, ADR-056) : la liste
 * n'affiche jamais que titre/type/date par notification et
 * canal/statut par livraison, mais `select("*")` envoyait quand même
 * `body` (montant et référence exacts de la transaction) au navigateur
 * de tout admin ayant `notification.read` — non rendu, mais lisible via
 * les outils de développement.
 */
export interface AdminNotificationDeliverySummary {
  id: string;
  channel: DeliveryRow["channel"];
  status: DeliveryRow["status"];
}
export interface AdminNotificationRow {
  id: string;
  title: string;
  event_type: string;
  created_at: string;
  deliveries: AdminNotificationDeliverySummary[];
}

/**
 * Back Office — Notifications (Prompt 22). Vue de supervision sur
 * `notifications`/`notification_deliveries` (Prompt 20) — aucune des
 * deux n'avait de fonction de lecture cross-utilisateurs jusqu'ici.
 * Lecture seule à l'exception de `retryDelivery`, déjà écrite au
 * Prompt 20 en anticipation exacte de cet écran.
 */
export async function adminListNotifications(page = 1): Promise<{
  notifications: AdminNotificationRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const admin = createAdminClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: notifications, count } = await admin
    .from("notifications")
    .select("id, title, event_type, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const ids = (notifications ?? []).map((n) => n.id);
  const { data: deliveries } =
    ids.length > 0
      ? await admin.from("notification_deliveries").select("id, notification_id, channel, status").in("notification_id", ids)
      : { data: [] as Pick<DeliveryRow, "id" | "notification_id" | "channel" | "status">[] };

  const deliveriesByNotification = new Map<string, AdminNotificationDeliverySummary[]>();
  for (const delivery of deliveries ?? []) {
    const list = deliveriesByNotification.get(delivery.notification_id) ?? [];
    // notification_id ne sert qu'au regroupement ci-dessus — jamais dans
    // la forme finale envoyée au client (Prompt 28, ADR-056).
    list.push({ id: delivery.id, channel: delivery.channel, status: delivery.status });
    deliveriesByNotification.set(delivery.notification_id, list);
  }

  return {
    notifications: (notifications ?? []).map((n) => ({ ...n, deliveries: deliveriesByNotification.get(n.id) ?? [] })),
    total: count ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

export interface DeliveryStatusBreakdown {
  channel: string;
  status: NotificationDeliveryStatus;
  count: number;
}

const FETCH_PAGE_SIZE = 1000;

export async function adminDeliveryStatusBreakdown(): Promise<DeliveryStatusBreakdown[]> {
  const admin = createAdminClient();

  // PostgREST plafonne une lecture sans `.range()` à 1000 lignes,
  // silencieusement — cette table croît sans borne (une ligne par
  // tentative de livraison). Pagine explicitement pour ne jamais fausser
  // le décompte une fois ce seuil dépassé (voir ledger/admin-queries.ts,
  // même bug repéré concrètement sur `ledger_entries`).
  const counts = new Map<string, number>();
  let from = 0;
  for (;;) {
    const { data } = await admin.from("notification_deliveries").select("channel, status").range(from, from + FETCH_PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const key = `${row.channel}::${row.status}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (data.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return [...counts.entries()].map(([key, count]) => {
    const [channel, status] = key.split("::");
    return { channel, status: status as NotificationDeliveryStatus, count };
  });
}
