"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/domains/rbac";
import { adminUpdateAnomalyStatus, type AdminActionResult } from "./admin-mutations";
import { runReconciliation, type RunReconciliationSummary } from "./run";
import type { ReconciliationAnomalyStatus } from "@/lib/supabase/database.types";

export type { AdminActionResult };

export async function adminUpdateAnomalyStatusAction(
  anomalyId: string,
  next: ReconciliationAnomalyStatus,
  note?: string
): Promise<AdminActionResult> {
  const auth = await checkPermission("reconciliation.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminUpdateAnomalyStatus(anomalyId, next, note);
  if (result.ok) revalidatePath("/admin/reconciliation");
  return result;
}

export type RunReconciliationActionResult = { ok: true; summary: RunReconciliationSummary } | { ok: false; error: string };

export async function adminRunReconciliationAction(): Promise<RunReconciliationActionResult> {
  const auth = await checkPermission("reconciliation.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const summary = await runReconciliation();
  revalidatePath("/admin/reconciliation");
  return { ok: true, summary };
}
