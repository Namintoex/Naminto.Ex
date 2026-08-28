"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Select } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { DOMAIN_EVENT_TYPES } from "@/domains/event-bus/types";
import type { AdminListEventDeliveriesResult, EventDeliveryCounts } from "@/domains/event-bus";
import type { DomainEventType, EventDeliveryStatus } from "@/lib/supabase/database.types";
import { AdminPagination } from "../../admin-pagination";
import { DispatchDueButton } from "./dispatch-due-button";
import { RetryDeliveryButton } from "./retry-delivery-button";

const STATUSES: EventDeliveryStatus[] = ["pending", "succeeded", "failed", "dead_letter"];

function statusVariant(status: EventDeliveryStatus) {
  if (status === "succeeded") return "success" as const;
  if (status === "pending") return "info" as const;
  if (status === "failed") return "warning" as const;
  return "danger" as const;
}

export function EventsView({
  result,
  counts,
  status,
  type,
}: {
  result: AdminListEventDeliveriesResult;
  counts: EventDeliveryCounts;
  status: EventDeliveryStatus | "all";
  type: DomainEventType | "all";
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
    return query ? `/admin/events?${query}` : "/admin/events";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.events")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.eventBus.overview.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-4 text-sm">
            <span>
              {t("admin.eventBus.overview.pending")}: <strong>{counts.pending}</strong>
            </span>
            <span>
              {t("admin.eventBus.overview.failed")}: <strong>{counts.failed}</strong>
            </span>
            <span>
              {t("admin.eventBus.overview.deadLetter")}: <strong>{counts.deadLetter}</strong>
            </span>
          </div>
          <DispatchDueButton />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-5">
          <form action="/admin/events" method="GET" className="contents">
            <Select
              name="status"
              defaultValue={status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.eventBus.filter.allStatuses") },
                ...STATUSES.map((s) => ({ value: s, label: t(`admin.eventBus.status.${s}`) })),
              ]}
            />
            <Select
              name="type"
              defaultValue={type}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.eventBus.filter.allTypes") },
                ...DOMAIN_EVENT_TYPES.map((et) => ({ value: et, label: et })),
              ]}
            />
          </form>
        </CardContent>
      </Card>

      {result.deliveries.length === 0 ? (
        <EmptyState title={t("admin.eventBus.empty")} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {result.deliveries.map((delivery) => (
              <li key={delivery.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">
                          {delivery.eventType} → {delivery.consumer}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {new Date(delivery.occurredAt).toLocaleString(locale)} · {delivery.correlationId}
                        </span>
                      </div>
                      <Badge variant={statusVariant(delivery.status)}>{t(`admin.eventBus.status.${delivery.status}`)}</Badge>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {t("admin.eventBus.column.attempts")}: {delivery.attempts}
                    </p>
                    {delivery.last_error && <p className="text-sm text-text-secondary">{delivery.last_error}</p>}
                    <details>
                      <summary className="cursor-pointer text-xs text-text-secondary">
                        {t("admin.eventBus.payload.toggle")}
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-surface-sunken p-2 text-xs">
                        {JSON.stringify(delivery.payload, null, 2)}
                      </pre>
                    </details>
                    {(delivery.status === "failed" || delivery.status === "dead_letter") && (
                      <RetryDeliveryButton deliveryId={delivery.id} />
                    )}
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
