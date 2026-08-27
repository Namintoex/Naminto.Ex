import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReconciliationAnomalyStatus } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/**
 * Cycle explicite du prompt (OPEN → INVESTIGATING → RESOLVED → CLOSED) —
 * `closed` reste toujours atteignable directement (faux positif), et une
 * réouverture reste possible pour corriger une clôture prématurée, même
 * choix que le cycle des dossiers support (Prompt 22).
 */
const NEXT_STATUS: Record<ReconciliationAnomalyStatus, ReconciliationAnomalyStatus[]> = {
  open: ["investigating", "closed"],
  investigating: ["resolved", "open"],
  resolved: ["closed", "investigating"],
  closed: ["investigating"],
};

/**
 * Ne touche jamais `ledger_entries`/`ledger_accounts` — une transition
 * de statut et, éventuellement, une note d'investigation. Séparée de
 * admin-actions.ts ("use server") pour rester testable directement.
 */
export async function adminUpdateAnomalyStatus(
  anomalyId: string,
  next: ReconciliationAnomalyStatus,
  note?: string
): Promise<AdminActionResult> {
  const admin = createAdminClient();
  const { data: anomaly } = await admin
    .from("reconciliation_anomalies")
    .select("status")
    .eq("id", anomalyId)
    .maybeSingle();
  if (!anomaly) return { ok: false, error: "admin.reconciliation.error.notFound" };

  if (!NEXT_STATUS[anomaly.status].includes(next)) {
    return { ok: false, error: "admin.reconciliation.error.invalidTransition" };
  }

  const { error } = await admin
    .from("reconciliation_anomalies")
    .update({ status: next, ...(note !== undefined ? { note } : {}) })
    .eq("id", anomalyId);
  if (error) return { ok: false, error: "admin.reconciliation.error.updateFailed" };

  return { ok: true };
}
