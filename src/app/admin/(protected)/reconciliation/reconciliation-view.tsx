"use client";

import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Select } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminAnomalyRow, AdminListAnomaliesResult, AnomalyCounts } from "@/domains/reconciliation";
import type { ReconciliationAnomalyStatus, ReconciliationAnomalyType } from "@/lib/supabase/database.types";
import { AdminPagination } from "../../admin-pagination";
import { AnomalyStatusButtons } from "./anomaly-status-buttons";
import { RunReconciliationButton } from "./run-reconciliation-button";

const STATUSES: ReconciliationAnomalyStatus[] = ["open", "investigating", "resolved", "closed"];
const TYPES: ReconciliationAnomalyType[] = ["missing", "duplicate", "amount_mismatch", "status_mismatch", "settlement_mismatch"];

function statusVariant(status: ReconciliationAnomalyStatus) {
  if (status === "open") return "danger" as const;
  if (status === "investigating") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "neutral" as const;
}

function AnomalySummary({ anomaly, locale }: { anomaly: AdminAnomalyRow; locale: string }) {
  const { t } = useLocale();
  const { ledger, provider, settlement } = anomaly.details;

  switch (anomaly.type) {
    case "missing":
      return <p>{t("admin.reconciliation.summary.missing")}</p>;
    case "duplicate":
      return (
        <p>
          {t("admin.reconciliation.summary.duplicate")} ({ledger.entryCount})
        </p>
      );
    case "amount_mismatch":
      return (
        <p>
          {t("admin.reconciliation.summary.amountMismatch")}{" "}
          <strong>{settlement.expectedSenderDebit.toLocaleString(locale)}</strong> ≠{" "}
          <strong>{ledger.totalDebit.toLocaleString(locale)}</strong>
        </p>
      );
    case "status_mismatch":
      return (
        <p>
          {t("admin.reconciliation.summary.statusMismatch")} <strong>{settlement.status}</strong> ≠{" "}
          <strong>{provider.status ?? "—"}</strong>
        </p>
      );
    case "settlement_mismatch":
      return (
        <p>
          {t("admin.reconciliation.summary.settlementMismatch")} {ledger.totalDebit.toLocaleString(locale)} ≠{" "}
          {ledger.totalCredit.toLocaleString(locale)}
        </p>
      );
    default:
      return null;
  }
}

export function ReconciliationView({
  result,
  counts,
  status,
  type,
}: {
  result: AdminListAnomaliesResult;
  counts: AnomalyCounts;
  status: ReconciliationAnomalyStatus | "all";
  type: ReconciliationAnomalyType | "all";
}) {
  const { t, locale } = useLocale();

  function buildHref(params: { status?: string; type?: string; page?: number }) {
    const qs = new URLSearchParams();
    const nextStatus = params.status ?? status;
    const nextType = params.type ?? type;
    if (nextStatus !== "all") qs.set("status", nextStatus);
    if (nextType !== "all") qs.set("type", nextType);
    if (params.page && params.page > 1) qs.set("page", String(params.page));
    const query = qs.toString();
    return query ? `/admin/reconciliation?${query}` : "/admin/reconciliation";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.reconciliation")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.reconciliation.overview.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-4 text-sm">
            <span>
              {t("admin.reconciliation.overview.open")}: <strong>{counts.open}</strong>
            </span>
            <span>
              {t("admin.reconciliation.overview.investigating")}: <strong>{counts.investigating}</strong>
            </span>
          </div>
          <RunReconciliationButton />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-5">
          <form action="/admin/reconciliation" method="GET" className="contents">
            <Select
              name="status"
              defaultValue={status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.reconciliation.filter.allStatuses") },
                ...STATUSES.map((s) => ({ value: s, label: t(`admin.reconciliation.status.${s}`) })),
              ]}
            />
            <Select
              name="type"
              defaultValue={type}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.reconciliation.filter.allTypes") },
                ...TYPES.map((tp) => ({ value: tp, label: t(`admin.reconciliation.type.${tp}`) })),
              ]}
            />
          </form>
        </CardContent>
      </Card>

      {result.anomalies.length === 0 ? (
        <EmptyState title={t("admin.reconciliation.empty")} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {result.anomalies.map((anomaly) => (
              <li key={anomaly.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <Link href={`/admin/transactions/${anomaly.reference}`} className="font-medium text-brand hover:underline">
                          {anomaly.reference}
                        </Link>
                        <span className="text-xs text-text-secondary">
                          {t(`admin.reconciliation.type.${anomaly.type}`)} ·{" "}
                          {new Date(anomaly.created_at).toLocaleString(locale)}
                        </span>
                      </div>
                      <Badge variant={statusVariant(anomaly.status)}>{t(`admin.reconciliation.status.${anomaly.status}`)}</Badge>
                    </div>
                    <div className="text-sm text-text-secondary">
                      <AnomalySummary anomaly={anomaly} locale={locale} />
                    </div>
                    <AnomalyStatusButtons anomalyId={anomaly.id} current={anomaly.status} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <AdminPagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(p) => buildHref({ page: p })}
          />
        </>
      )}
    </div>
  );
}
