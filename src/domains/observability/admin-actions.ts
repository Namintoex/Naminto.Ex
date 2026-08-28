"use server";

import { checkPermission } from "@/domains/rbac";
import { adminTransactionTrace, type TransactionTraceResult } from "./admin-queries";

export type AdminTraceResult = { ok: true; trace: TransactionTraceResult } | { ok: false; error: string };

export async function adminTransactionTraceAction(reference: string): Promise<AdminTraceResult> {
  const auth = await checkPermission("observability.read");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const trace = await adminTransactionTrace(reference);
  if (!trace) return { ok: false, error: "admin.observability.error.transactionNotFound" };

  return { ok: true, trace };
}
