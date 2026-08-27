import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { TransactionStatus } from "../transaction-status";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type StatusEventRow = Database["public"]["Tables"]["transaction_status_events"]["Row"];
type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];

const PAGE_SIZE = 25;

export interface AdminTransactionFilters {
  reference?: string;
  status?: TransactionStatus;
}

export interface AdminListTransactionsResult {
  transactions: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Back Office — Transactions (Prompt 22). `transactions_select_participant`
 * (0005_transactions.sql) ne couvre que l'expéditeur/destinataire : un
 * admin doit voir n'importe quelle transaction, donc service_role. Ne
 * réimplémente aucune règle métier — lecture seule, jamais une
 * transition d'état (celles-ci restent exclusivement du ressort de
 * l'orchestrateur, Prompt 09).
 */
export async function adminListTransactions(
  filters: AdminTransactionFilters = {},
  page = 1
): Promise<AdminListTransactionsResult> {
  const admin = createAdminClient();
  let query = admin.from("transactions").select("*", { count: "exact" });

  if (filters.reference) {
    query = query.ilike("reference", `%${filters.reference.trim()}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  return { transactions: data ?? [], total: count ?? 0, page: safePage, pageSize: PAGE_SIZE };
}

export interface AdminTransactionDetail {
  transaction: TransactionRow;
  timeline: StatusEventRow[];
  ledgerEntries: LedgerEntryRow[];
}

export async function adminGetTransactionDetail(reference: string): Promise<AdminTransactionDetail | null> {
  const admin = createAdminClient();
  const { data: transaction } = await admin
    .from("transactions")
    .select("*")
    .eq("reference", reference.trim().toUpperCase())
    .maybeSingle();
  if (!transaction) return null;

  const [{ data: timeline }, { data: ledgerEntries }] = await Promise.all([
    admin
      .from("transaction_status_events")
      .select("*")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: true }),
    admin.from("ledger_entries").select("*").eq("transaction_id", transaction.id),
  ]);

  return { transaction, timeline: timeline ?? [], ledgerEntries: ledgerEntries ?? [] };
}

export interface AdminDashboardStats {
  transactionsToday: number;
  settledVolumeToday: number;
  settledCountToday: number;
  failedCountToday: number;
}

/** Back Office — Dashboard (Prompt 22). Agrégats simples, calculés à la volée — aucun cumul stocké. */
export async function adminDashboardStats(): Promise<AdminDashboardStats> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: todayTransactions } = await admin
    .from("transactions")
    .select("amount, status")
    .gte("created_at", startOfDay.toISOString());

  const rows = todayTransactions ?? [];
  const settled = rows.filter((t) => t.status === "settled");
  const failed = rows.filter((t) => ["failed", "rejected", "expired", "cancelled"].includes(t.status));

  return {
    transactionsToday: rows.length,
    settledVolumeToday: settled.reduce((sum, t) => sum + Number(t.amount), 0),
    settledCountToday: settled.length,
    failedCountToday: failed.length,
  };
}

export const RISK_REASON_PREFIXES = ["RISK_REJECTION"] as const;
export const FRAUD_REASON_PREFIXES = ["FRAUD_BLOCKED", "MANUAL_REVIEW_REQUIRED"] as const;
const RISK_FRAUD_REASON_PREFIXES = [...RISK_REASON_PREFIXES, ...FRAUD_REASON_PREFIXES];

/**
 * « Risk »/« Fraud » (Prompt 22) : ni le Risk Engine (Prompt 17) ni le
 * Fraud Engine (Prompt 18) ne persistent de décision (documenté comme
 * lecture seule, sans effet de bord — voir ARCHITECTURE.md). La seule
 * trace réelle est la raison enregistrée sur `transaction_status_events`
 * par l'orchestrateur (`${code}: ${message}`, orchestrator.ts) au moment
 * du rejet — on la relit telle quelle, sans reconstituer ni deviner une
 * décision qui n'a jamais été stockée.
 */
export async function adminListRiskAndFraudEvents(
  prefixes: readonly string[] = RISK_FRAUD_REASON_PREFIXES,
  limit = 50
): Promise<(StatusEventRow & { reference: string })[]> {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("transaction_status_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const filtered = (events ?? [])
    .filter((e) => prefixes.some((prefix) => e.reason?.startsWith(prefix)))
    .slice(0, limit);

  if (filtered.length === 0) return [];

  const transactionIds = [...new Set(filtered.map((e) => e.transaction_id))];
  const { data: transactions } = await admin.from("transactions").select("id, reference").in("id", transactionIds);
  const referenceById = new Map((transactions ?? []).map((t) => [t.id, t.reference]));

  return filtered.map((e) => ({ ...e, reference: referenceById.get(e.transaction_id) ?? "—" }));
}
