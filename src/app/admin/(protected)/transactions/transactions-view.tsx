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
import type { AdminListTransactionsResult } from "@/domains/payments/history";
import { AdminPagination } from "../../admin-pagination";

function statusVariant(status: TransactionStatus) {
  if (status === "settled") return "success" as const;
  if (["failed", "rejected", "disputed"].includes(status)) return "danger" as const;
  if (["expired", "cancelled", "reversed", "refunded"].includes(status)) return "warning" as const;
  if (status === "created") return "neutral" as const;
  return "info" as const;
}

export function TransactionsView({
  result,
  filters,
}: {
  result: AdminListTransactionsResult;
  filters: { q: string; status: string };
}) {
  const { t, locale } = useLocale();

  function buildHref(page: number) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/admin/transactions?${qs}` : "/admin/transactions";
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.transactions")}</h1>

      <Card>
        <CardContent className="pt-5">
          <form action="/admin/transactions" method="GET" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input name="q" placeholder={t("admin.transactions.search.placeholder")} defaultValue={filters.q} />
            <Select
              name="status"
              defaultValue={filters.status}
              placeholder={t("admin.transactions.filter.status.all")}
              options={TRANSACTION_STATUSES.map((s) => ({ value: s, label: t(`transaction.status.${s}`) }))}
            />
            <Button type="submit">
              <Search className="size-4" aria-hidden />
            </Button>
          </form>
        </CardContent>
      </Card>

      {result.transactions.length === 0 ? (
        <EmptyState title={t("admin.transactions.empty")} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.column.reference")}</TableHead>
                <TableHead>{t("table.column.amount")}</TableHead>
                <TableHead>{t("table.column.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <Link href={`/admin/transactions/${tx.reference}`} className="font-medium text-brand hover:underline">
                      {tx.reference}
                    </Link>
                    <p className="text-xs text-text-secondary">{new Date(tx.created_at).toLocaleDateString(locale)}</p>
                  </TableCell>
                  <TableCell>
                    {Number(tx.amount).toLocaleString(locale)} {tx.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(tx.status)}>{t(`transaction.status.${tx.status}`)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminPagination page={result.page} total={result.total} pageSize={result.pageSize} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}
