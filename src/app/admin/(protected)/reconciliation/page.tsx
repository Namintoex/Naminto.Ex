import { adminAnomalyCounts, adminListAnomalies } from "@/domains/reconciliation";
import { requirePermission } from "@/domains/rbac";
import type { ReconciliationAnomalyStatus, ReconciliationAnomalyType } from "@/lib/supabase/database.types";
import { ReconciliationView } from "./reconciliation-view";

const STATUSES: ReconciliationAnomalyStatus[] = ["open", "investigating", "resolved", "closed"];
const TYPES: ReconciliationAnomalyType[] = ["missing", "duplicate", "amount_mismatch", "status_mismatch", "settlement_mismatch"];

function isStatus(value: string | undefined): value is ReconciliationAnomalyStatus {
  return Boolean(value) && (STATUSES as string[]).includes(value as string);
}
function isType(value: string | undefined): value is ReconciliationAnomalyType {
  return Boolean(value) && (TYPES as string[]).includes(value as string);
}

export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>;
}) {
  await requirePermission("reconciliation.read");

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const status = isStatus(sp.status) ? sp.status : undefined;
  const type = isType(sp.type) ? sp.type : undefined;

  const [result, counts] = await Promise.all([adminListAnomalies({ status, type }, page), adminAnomalyCounts()]);

  return <ReconciliationView result={result} counts={counts} status={status ?? "all"} type={type ?? "all"} />;
}
