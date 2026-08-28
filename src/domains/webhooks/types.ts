import type { Database, Provider, WebhookEventStatus } from "@/lib/supabase/database.types";

export type { WebhookEventStatus };

export type WebhookEventRow = Database["public"]["Tables"]["webhook_events"]["Row"];

export type WebhookRejectReason =
  | "missing_signature"
  | "invalid_signature"
  | "invalid_payload"
  | "stale_replay"
  | "out_of_order";

export interface ProcessWebhookResult {
  httpStatus: number;
  status: WebhookEventStatus;
  reason?: WebhookRejectReason;
  eventRowId?: string;
}

export interface AdminWebhookEventFilters {
  provider?: Provider;
  status?: WebhookEventStatus;
}
