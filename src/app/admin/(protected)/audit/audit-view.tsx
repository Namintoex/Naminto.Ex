"use client";

import Link from "next/link";
import { Card, CardContent, EmptyState, Select } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminListSecurityEventsResult } from "@/domains/identity/admin-audit-queries";
import type { SecurityEventType } from "@/domains/identity/security-events";
import { AdminPagination } from "../../admin-pagination";

export function AuditView({
  result,
  type,
  eventTypes,
}: {
  result: AdminListSecurityEventsResult;
  type: SecurityEventType | "all";
  eventTypes: SecurityEventType[];
}) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.audit")}</h1>

      <Card>
        <CardContent className="pt-5">
          <form action="/admin/audit" method="GET" className="max-w-xs">
            <Select
              name="type"
              defaultValue={type}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.audit.filter.all") },
                ...eventTypes.map((eventType) => ({ value: eventType, label: t(`security.event.${eventType}`) })),
              ]}
            />
          </form>
        </CardContent>
      </Card>

      {result.events.length === 0 ? (
        <EmptyState title={t("admin.audit.empty")} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border-default">
            {result.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="text-text-primary">{t(`security.event.${event.type}`)}</span>
                  {event.namintoId && (
                    <Link href={`/admin/users/${event.user_id}`} className="text-xs text-brand hover:underline">
                      {event.namintoId}
                    </Link>
                  )}
                </div>
                <span className="text-text-secondary">{new Date(event.created_at).toLocaleString(locale)}</span>
              </li>
            ))}
          </ul>
          <AdminPagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(p) => `/admin/audit?type=${type}&page=${p}`}
          />
        </>
      )}
    </div>
  );
}
