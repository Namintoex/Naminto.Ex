"use client";

import Link from "next/link";
import { Badge, Card, CardContent, EmptyState, Select } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminListTicketsResult } from "@/domains/assist";
import type { TicketStatus } from "@/lib/supabase/database.types";
import { AdminPagination } from "../admin-pagination";
import { TicketStatusButtons } from "./ticket-status-buttons";

const STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

function statusVariant(status: TicketStatus) {
  if (status === "open") return "warning" as const;
  if (status === "in_progress") return "info" as const;
  if (status === "resolved") return "success" as const;
  return "neutral" as const;
}

export function SupportView({ result, status }: { result: AdminListTicketsResult; status: TicketStatus | "all" }) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.support")}</h1>

      <Card>
        <CardContent className="pt-5">
          <form action="/admin/support" method="GET" className="max-w-xs">
            <Select
              name="status"
              defaultValue={status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.support.filter.all") },
                ...STATUSES.map((s) => ({ value: s, label: t(`admin.support.status.${s}`) })),
              ]}
            />
          </form>
        </CardContent>
      </Card>

      {result.tickets.length === 0 ? (
        <EmptyState title={t("admin.support.empty")} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {result.tickets.map((ticket) => (
              <li key={ticket.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">{ticket.subject}</span>
                        <span className="text-xs text-text-secondary">
                          {t(`assist.ticket.category.${ticket.category}`)} ·{" "}
                          {new Date(ticket.created_at).toLocaleString(locale)}
                        </span>
                      </div>
                      <Badge variant={statusVariant(ticket.status)}>{t(`admin.support.status.${ticket.status}`)}</Badge>
                    </div>
                    <p className="text-sm text-text-secondary">{ticket.description}</p>
                    {ticket.related_transaction_id && (
                      <Link href={`/admin/transactions`} className="text-xs text-brand hover:underline">
                        {t("table.column.reference")}: {ticket.related_transaction_id.slice(0, 8)}
                      </Link>
                    )}
                    <TicketStatusButtons ticketId={ticket.id} current={ticket.status} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <AdminPagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(p) => `/admin/support?status=${status}&page=${p}`}
          />
        </>
      )}
    </div>
  );
}
