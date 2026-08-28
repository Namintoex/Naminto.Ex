import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminAnomalyCounts } from "@/domains/reconciliation";
import { adminWebhookEventCounts } from "@/domains/webhooks";
import type { SecurityEventType } from "@/domains/identity/security-events";
import type { Database } from "@/lib/supabase/database.types";

type TransactionStatus = Database["public"]["Tables"]["transactions"]["Row"]["status"];

type AdminClient = ReturnType<typeof createAdminClient>;
const FETCH_PAGE_SIZE = 1000;

function cutoffIso(windowHours: number): string {
  return new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[Math.max(0, index)];
}

/** Pagine explicitement — le plafond silencieux à 1000 lignes de PostgREST sans `.range()` est un bug déjà repéré dans ce dépôt (Prompt 22). */
async function fetchAllInWindow<T>(
  admin: AdminClient,
  table: "request_logs" | "provider_call_logs",
  columns: string,
  windowHours: number
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data } = await admin
      .from(table)
      .select(columns)
      .gte("created_at", cutoffIso(windowHours))
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }
  return rows;
}

export interface ApiMetrics {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

/** API latency + error rate (Prompt 27) — sur les requêtes importantes journalisées (payment.orchestrator, webhooks), pas chaque requête HTTP. */
export async function adminApiMetrics(windowHours = 24): Promise<ApiMetrics> {
  const admin = createAdminClient();
  const rows = await fetchAllInWindow<{ duration_ms: number; status_code: number }>(
    admin,
    "request_logs",
    "duration_ms, status_code",
    windowHours
  );

  const durations = rows.map((r) => r.duration_ms).sort((a, b) => a - b);
  const errorCount = rows.filter((r) => r.status_code >= 400).length;

  return {
    requestCount: rows.length,
    errorCount,
    errorRate: rows.length > 0 ? errorCount / rows.length : 0,
    avgDurationMs: durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
    p95DurationMs: Math.round(percentile(durations, 95)),
  };
}

export interface ProviderMetric {
  provider: string;
  callCount: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
}

/** Provider latency + provider errors (Prompt 27) — un point par fournisseur, instrumenté au Provider Gateway (registry.ts), jamais dans chaque adapter. */
export async function adminProviderMetrics(windowHours = 24): Promise<ProviderMetric[]> {
  const admin = createAdminClient();
  const rows = await fetchAllInWindow<{ provider: string; duration_ms: number; success: boolean }>(
    admin,
    "provider_call_logs",
    "provider, duration_ms, success",
    windowHours
  );

  const byProvider = new Map<string, { durations: number[]; errors: number }>();
  for (const row of rows) {
    const entry = byProvider.get(row.provider) ?? { durations: [], errors: 0 };
    entry.durations.push(row.duration_ms);
    if (!row.success) entry.errors += 1;
    byProvider.set(row.provider, entry);
  }

  return [...byProvider.entries()].map(([provider, { durations, errors }]) => ({
    provider,
    callCount: durations.length,
    errorCount: errors,
    errorRate: durations.length > 0 ? errors / durations.length : 0,
    avgDurationMs: durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
  }));
}

export interface TransactionSuccessRate {
  settled: number;
  failedLike: number;
  successRate: number;
}

const FAILED_LIKE_STATUSES: TransactionStatus[] = ["failed", "rejected", "expired", "cancelled"];

/** Transaction success rate (Prompt 27) — dérivée de transactions, jamais recalculée ailleurs. */
export async function adminTransactionSuccessRate(windowHours = 24): Promise<TransactionSuccessRate> {
  const admin = createAdminClient();
  const [settled, failedLike] = await Promise.all([
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "settled")
      .gte("created_at", cutoffIso(windowHours)),
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .in("status", FAILED_LIKE_STATUSES)
      .gte("created_at", cutoffIso(windowHours)),
  ]);

  const settledCount = settled.count ?? 0;
  const failedCount = failedLike.count ?? 0;
  const concluded = settledCount + failedCount;

  return {
    settled: settledCount,
    failedLike: failedCount,
    successRate: concluded > 0 ? settledCount / concluded : 0,
  };
}

export interface NotificationFailureRate {
  failed: number;
  total: number;
  failureRate: number;
}

/** Notification failures (Prompt 27) — dérivée de notification_deliveries. */
export async function adminNotificationFailureRate(windowHours = 24): Promise<NotificationFailureRate> {
  const admin = createAdminClient();
  const [failed, total] = await Promise.all([
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "FAILED")
      .gte("created_at", cutoffIso(windowHours)),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoffIso(windowHours)),
  ]);

  const failedCount = failed.count ?? 0;
  const totalCount = total.count ?? 0;

  return { failed: failedCount, total: totalCount, failureRate: totalCount > 0 ? failedCount / totalCount : 0 };
}

/**
 * Anomalies d'authentification (Prompt 27) — sous-ensemble de
 * SecurityEventType représentant un signal anormal (échec, verrouillage,
 * nouvel appareil), jamais les événements de routine (login_success,
 * logout, device_added…). Aucune source ne définit précisément ce qui
 * constitue une « anomalie » — choix raisonnable assumé, voir
 * docs/DECISIONS.md.
 */
const AUTH_ANOMALY_TYPES: SecurityEventType[] = ["login_failed", "pin_verification_failed", "pin_locked", "new_device_login"];

export async function adminAuthAnomalyCount(windowHours = 24): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .in("type", AUTH_ANOMALY_TYPES)
    .gte("created_at", cutoffIso(windowHours));
  return count ?? 0;
}

export interface ObservabilityOverview {
  api: ApiMetrics;
  providers: ProviderMetric[];
  transactionSuccessRate: TransactionSuccessRate;
  webhookFailures: number;
  reconciliationAnomalies: number;
  notificationFailures: NotificationFailureRate;
  authAnomalies: number;
}

/** Les neuf mesures du Prompt 27, agrégées pour le tableau de bord Back Office. */
export async function adminObservabilityOverview(windowHours = 24): Promise<ObservabilityOverview> {
  const [api, providers, transactionSuccessRate, webhookCounts, reconciliationCounts, notificationFailures, authAnomalies] =
    await Promise.all([
      adminApiMetrics(windowHours),
      adminProviderMetrics(windowHours),
      adminTransactionSuccessRate(windowHours),
      adminWebhookEventCounts(),
      adminAnomalyCounts(),
      adminNotificationFailureRate(windowHours),
      adminAuthAnomalyCount(windowHours),
    ]);

  return {
    api,
    providers,
    transactionSuccessRate,
    webhookFailures: webhookCounts.rejected,
    reconciliationAnomalies: reconciliationCounts.open + reconciliationCounts.investigating,
    notificationFailures,
    authAnomalies,
  };
}

export interface TransactionTraceEvent {
  source: "status" | "event";
  label: string;
  detail: string | null;
  timestamp: string;
}

export interface TransactionTraceResult {
  transactionId: string;
  reference: string;
  timeline: TransactionTraceEvent[];
}

/**
 * Suivi de bout en bout d'une transaction (Prompt 27, exigence
 * explicite) — fusionne transaction_status_events (Prompt 08) et
 * domain_events (Prompt 26, filtré par correlation_id) en une seule
 * chronologie, jamais recalculée : chaque source reste la sienne.
 */
export async function adminTransactionTrace(reference: string): Promise<TransactionTraceResult | null> {
  const admin = createAdminClient();

  const { data: tx } = await admin.from("transactions").select("id, reference").eq("reference", reference.trim()).maybeSingle();
  if (!tx) return null;

  const [{ data: statusEvents }, { data: domainEvents }] = await Promise.all([
    admin
      .from("transaction_status_events")
      .select("from_status, to_status, reason, created_at")
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: true }),
    admin
      .from("domain_events")
      .select("type, payload, occurred_at")
      .eq("correlation_id", tx.id)
      .order("occurred_at", { ascending: true }),
  ]);

  const timeline: TransactionTraceEvent[] = [
    ...(statusEvents ?? []).map((e) => ({
      source: "status" as const,
      label: e.from_status ? `${e.from_status} → ${e.to_status}` : e.to_status,
      detail: e.reason,
      timestamp: e.created_at,
    })),
    ...(domainEvents ?? []).map((e) => ({
      source: "event" as const,
      label: e.type,
      detail: JSON.stringify(e.payload),
      timestamp: e.occurred_at,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { transactionId: tx.id, reference: tx.reference, timeline };
}
