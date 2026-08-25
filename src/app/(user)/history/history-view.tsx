"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { TRANSACTION_STATUSES, type TransactionStatus } from "@/domains/payments/transaction-status";
import type { CounterpartyInfo } from "@/domains/payments/history/types";
import type { Database } from "@/lib/supabase/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function statusVariant(status: TransactionStatus) {
  if (status === "settled") return "success" as const;
  if (["failed", "rejected", "disputed"].includes(status)) return "danger" as const;
  if (["expired", "cancelled", "reversed", "refunded"].includes(status)) return "warning" as const;
  if (status === "created") return "neutral" as const;
  return "info" as const;
}

export function HistoryView({
  rows,
  total,
  page,
  pageSize,
  filters,
}: {
  rows: { tx: TransactionRow; counterparty: CounterpartyInfo }[];
  total: number;
  page: number;
  pageSize: number;
  filters: { q: string; status: string; direction: string; from: string; to: string };
}) {
  const { t, locale } = useLocale();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/history?${qs}` : "/history";
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("history.title")}</h1>

      <Card>
        <CardContent className="pt-5">
          <form action="/history" method="GET" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              name="q"
              label={t("history.search.label")}
              placeholder={t("history.search.placeholder")}
              defaultValue={filters.q}
              className="lg:col-span-2"
            />
            <Select
              name="status"
              label={t("history.filters.status.label")}
              defaultValue={filters.status}
              placeholder={t("history.filters.status.all")}
              options={TRANSACTION_STATUSES.map((s) => ({ value: s, label: t(`transaction.status.${s}`) }))}
            />
            <Select
              name="direction"
              label={t("history.filters.direction.label")}
              defaultValue={filters.direction}
              placeholder={t("history.filters.direction.all")}
              options={[
                { value: "sent", label: t("history.filters.direction.sent") },
                { value: "received", label: t("history.filters.direction.received") },
              ]}
            />
            <Input type="date" name="from" label={t("history.filters.from.label")} defaultValue={filters.from} />
            <Input type="date" name="to" label={t("history.filters.to.label")} defaultValue={filters.to} />
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button type="submit" className="flex-1">
                <Search className="size-4" aria-hidden />
                {t("history.filters.apply")}
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link href="/history">{t("history.filters.reset")}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title={t("history.list.empty.title")} description={t("history.list.empty.body")} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("history.detail.reference")}</TableHead>
                <TableHead>{t("history.detail.counterparty")}</TableHead>
                <TableHead>{t("history.list.amount")}</TableHead>
                <TableHead>{t("history.detail.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ tx, counterparty }) => {
                const label =
                  counterparty.kind === "own_linked_account"
                    ? t("history.list.counterparty.ownAccount")
                    : counterparty.label;
                return (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Link href={`/history/${tx.reference}`} className="font-medium text-brand hover:underline">
                        {tx.reference}
                      </Link>
                      <p className="text-xs text-text-secondary">
                        {new Date(tx.created_at).toLocaleDateString(locale)}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-0 max-w-40 truncate">{label}</TableCell>
                    <TableCell>
                      {Number(tx.amount).toLocaleString(locale)} {tx.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tx.status)}>{t(`transaction.status.${tx.status}`)}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            {page > 1 ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={pageHref(page - 1)}>{t("history.pagination.previous")}</Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                {t("history.pagination.previous")}
              </Button>
            )}
            <span className="text-xs text-text-secondary">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={pageHref(page + 1)}>{t("history.pagination.next")}</Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                {t("history.pagination.next")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
