import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, ReconciliationAnomalyStatus, ReconciliationAnomalyType } from "@/lib/supabase/database.types";
import type { AnomalyDetails } from "./types";

type AnomalyRow = Database["public"]["Tables"]["reconciliation_anomalies"]["Row"];

export interface AdminAnomalyRow extends Omit<AnomalyRow, "details"> {
  details: AnomalyDetails;
  reference: string;
}

const PAGE_SIZE = 25;

export interface AdminListAnomaliesResult {
  anomalies: AdminAnomalyRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminAnomalyFilters {
  status?: ReconciliationAnomalyStatus;
  type?: ReconciliationAnomalyType;
}

/** Back Office — Reconciliation (Prompt 24). Lecture seule stricte : aucune écriture Ledger n'est jamais exposée ici. */
export async function adminListAnomalies(filters: AdminAnomalyFilters = {}, page = 1): Promise<AdminListAnomaliesResult> {
  const admin = createAdminClient();
  let query = admin.from("reconciliation_anomalies").select("*", { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("type", filters.type);

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  const anomalies = data ?? [];

  const transactionIds = [...new Set(anomalies.map((a) => a.transaction_id))];
  const { data: transactions } =
    transactionIds.length > 0
      ? await admin.from("transactions").select("id, reference").in("id", transactionIds)
      : { data: [] as { id: string; reference: string }[] };
  const referenceById = new Map((transactions ?? []).map((t) => [t.id, t.reference]));

  return {
    anomalies: anomalies.map((a) => ({
      ...a,
      details: a.details as unknown as AnomalyDetails,
      reference: referenceById.get(a.transaction_id) ?? "—",
    })),
    total: count ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

export interface AnomalyCounts {
  open: number;
  investigating: number;
}

export async function adminAnomalyCounts(): Promise<AnomalyCounts> {
  const admin = createAdminClient();
  const [open, investigating] = await Promise.all([
    admin.from("reconciliation_anomalies").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("reconciliation_anomalies").select("id", { count: "exact", head: true }).eq("status", "investigating"),
  ]);
  return { open: open.count ?? 0, investigating: investigating.count ?? 0 };
}
