"use client";

import Link from "next/link";
import { Card, CardContent, EmptyState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { Database } from "@/lib/supabase/database.types";

type StatusEventRow = Database["public"]["Tables"]["transaction_status_events"]["Row"];

export function RiskFraudEventsView({
  title,
  events,
}: {
  title: string;
  events: (StatusEventRow & { reference: string })[];
}) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t(title)}</h1>

      <Card>
        <CardContent className="pt-5">
          {events.length === 0 ? (
            <EmptyState title={t("admin.risk.empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {events.map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <Link href={`/admin/transactions/${event.reference}`} className="font-medium text-brand hover:underline">
                      {event.reference}
                    </Link>
                    <span className="text-text-secondary">{new Date(event.created_at).toLocaleString(locale)}</span>
                  </div>
                  <span className="text-xs text-text-secondary">{event.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
