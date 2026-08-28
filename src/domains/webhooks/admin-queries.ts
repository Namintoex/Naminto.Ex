import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminWebhookEventFilters, WebhookEventRow } from "./types";

const PAGE_SIZE = 25;

export interface AdminListWebhookEventsResult {
  events: WebhookEventRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Back Office — Webhooks (Prompt 25). Lecture seule sur le journal append-only. */
export async function adminListWebhookEvents(
  filters: AdminWebhookEventFilters = {},
  page = 1
): Promise<AdminListWebhookEventsResult> {
  const admin = createAdminClient();
  let query = admin.from("webhook_events").select("*", { count: "exact" });
  if (filters.provider) query = query.eq("provider", filters.provider);
  if (filters.status) query = query.eq("status", filters.status);

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);

  return {
    events: data ?? [],
    total: count ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

export interface WebhookEventCounts {
  rejected: number;
  duplicate: number;
}

export async function adminWebhookEventCounts(): Promise<WebhookEventCounts> {
  const admin = createAdminClient();
  const [rejected, duplicate] = await Promise.all([
    admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "duplicate"),
  ]);
  return { rejected: rejected.count ?? 0, duplicate: duplicate.count ?? 0 };
}
