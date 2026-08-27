import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { SecurityEventType } from "./security-events";

type SecurityEventRow = Database["public"]["Tables"]["security_events"]["Row"];

const PAGE_SIZE = 50;

export interface AdminSecurityEventRow extends SecurityEventRow {
  namintoId: string | null;
}

export interface AdminListSecurityEventsResult {
  events: AdminSecurityEventRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Back Office — Audit (Prompt 22). `security_events` n'a jamais eu de
 * lecture cross-utilisateurs (append-only, service_role only depuis
 * 0001_identity.sql) : première fois que cette table est consultable
 * dans son ensemble. Lecture seule stricte — jamais d'écriture ici,
 * l'append-only reste garanti par `logSecurityEvent` uniquement.
 */
export async function adminListSecurityEvents(
  type?: SecurityEventType,
  page = 1
): Promise<AdminListSecurityEventsResult> {
  const admin = createAdminClient();
  let query = admin.from("security_events").select("*", { count: "exact" });
  if (type) {
    query = query.eq("type", type);
  }

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: events, count } = await query.order("created_at", { ascending: false }).range(from, to);

  const userIds = [...new Set((events ?? []).map((e) => e.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await admin.from("identity_profiles").select("user_id, naminto_id").in("user_id", userIds)
      : { data: [] as { user_id: string; naminto_id: string }[] };
  const namintoIdByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.naminto_id]));

  return {
    events: (events ?? []).map((e) => ({ ...e, namintoId: namintoIdByUser.get(e.user_id) ?? null })),
    total: count ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}
