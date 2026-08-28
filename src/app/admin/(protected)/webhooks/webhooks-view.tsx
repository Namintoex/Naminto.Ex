"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Select } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminListWebhookEventsResult, WebhookEventCounts } from "@/domains/webhooks";
import type { Provider, WebhookEventStatus } from "@/lib/supabase/database.types";
import { AdminPagination } from "../../admin-pagination";
import { ReplayWebhookButton } from "./replay-webhook-button";

const PROVIDERS: Provider[] = ["orange", "mtn", "moov", "wave", "prepaid_card"];
const STATUSES: WebhookEventStatus[] = ["processed", "duplicate", "rejected"];

function statusVariant(status: WebhookEventStatus) {
  if (status === "processed") return "success" as const;
  if (status === "duplicate") return "warning" as const;
  return "danger" as const;
}

/** provider.prepaid_card n'existe pas tel quel — la clé i18n générique existante est provider.prepaidCard (Prompt 07). */
function providerLabelKey(p: Provider): string {
  return p === "prepaid_card" ? "provider.prepaidCard" : `provider.${p}`;
}

export function WebhooksView({
  result,
  counts,
  provider,
  status,
}: {
  result: AdminListWebhookEventsResult;
  counts: WebhookEventCounts;
  provider: Provider | "all";
  status: WebhookEventStatus | "all";
}) {
  const { t, locale } = useLocale();

  function buildHref(params: { provider?: string; status?: string; page?: number }) {
    const qs = new URLSearchParams();
    const nextProvider = params.provider ?? provider;
    const nextStatus = params.status ?? status;
    if (nextProvider !== "all") qs.set("provider", nextProvider);
    if (nextStatus !== "all") qs.set("status", nextStatus);
    if (params.page && params.page > 1) qs.set("page", String(params.page));
    const query = qs.toString();
    return query ? `/admin/webhooks?${query}` : "/admin/webhooks";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.webhooks")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.webhooks.overview.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 text-sm">
          <span>
            {t("admin.webhooks.overview.rejected")}: <strong>{counts.rejected}</strong>
          </span>
          <span>
            {t("admin.webhooks.overview.duplicate")}: <strong>{counts.duplicate}</strong>
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-5">
          <form action="/admin/webhooks" method="GET" className="contents">
            <Select
              name="provider"
              defaultValue={provider}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.webhooks.filter.allProviders") },
                ...PROVIDERS.map((p) => ({ value: p, label: t(providerLabelKey(p)) })),
              ]}
            />
            <Select
              name="status"
              defaultValue={status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.webhooks.filter.allStatuses") },
                ...STATUSES.map((s) => ({ value: s, label: t(`admin.webhooks.status.${s}`) })),
              ]}
            />
          </form>
        </CardContent>
      </Card>

      {result.events.length === 0 ? (
        <EmptyState title={t("admin.webhooks.empty")} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {result.events.map((event) => (
              <li key={event.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">
                          {t(providerLabelKey(event.provider))} · {event.event_type}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {new Date(event.created_at).toLocaleString(locale)}
                          {event.provider_transaction_id ? ` · ${event.provider_transaction_id}` : ""}
                        </span>
                      </div>
                      <Badge variant={statusVariant(event.status)}>{t(`admin.webhooks.status.${event.status}`)}</Badge>
                    </div>
                    {event.reject_reason && (
                      <p className="text-sm text-text-secondary">
                        {t(`admin.webhooks.reason.${event.reject_reason}`)}
                      </p>
                    )}
                    {event.replay_of && (
                      <p className="text-xs text-text-secondary">{t("admin.webhooks.replayedNotice")}</p>
                    )}
                    <details>
                      <summary className="cursor-pointer text-xs text-text-secondary">
                        {t("admin.webhooks.payload.toggle")}
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-surface-sunken p-2 text-xs">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </details>
                    {event.signature_valid && <ReplayWebhookButton eventRowId={event.id} />}
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
