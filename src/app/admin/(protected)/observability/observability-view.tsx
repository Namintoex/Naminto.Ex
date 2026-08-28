"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { ObservabilityOverview } from "@/domains/observability";
import { TransactionTraceSearch } from "./transaction-trace-search";

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function ObservabilityView({ overview }: { overview: ObservabilityOverview }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.observability")}</h1>
      <p className="text-sm text-text-secondary">{t("admin.observability.windowLabel")}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.observability.section.api")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.requestCount")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.api.requestCount}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.errorRate")}</div>
            <div className="text-lg font-semibold text-text-primary">{pct(overview.api.errorRate)}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.avgDuration")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.api.avgDurationMs} ms</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.p95Duration")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.api.p95DurationMs} ms</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.observability.section.providers")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {overview.providers.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("admin.observability.providers.empty")}</p>
          ) : (
            overview.providers.map((p) => (
              <div key={p.provider} className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">{p.provider}</span>
                <span className="text-text-secondary">
                  {p.callCount} {t("admin.observability.metric.calls")} · {pct(p.errorRate)} {t("admin.observability.metric.errorRate")} ·{" "}
                  {p.avgDurationMs} ms
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.observability.section.transactions")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.successRate")}</div>
            <div className="text-lg font-semibold text-text-primary">{pct(overview.transactionSuccessRate.successRate)}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.settled")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.transactionSuccessRate.settled}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.failedLike")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.transactionSuccessRate.failedLike}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.observability.section.health")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.webhookFailures")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.webhookFailures}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.reconciliationAnomalies")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.reconciliationAnomalies}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.notificationFailureRate")}</div>
            <div className="text-lg font-semibold text-text-primary">{pct(overview.notificationFailures.failureRate)}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">{t("admin.observability.metric.authAnomalies")}</div>
            <div className="text-lg font-semibold text-text-primary">{overview.authAnomalies}</div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-sm font-semibold text-text-primary">{t("admin.observability.section.trace")}</h2>
      <TransactionTraceSearch />
    </div>
  );
}
