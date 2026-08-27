"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminTransactionDetail } from "@/domains/payments/history";
import type { TransactionStatus } from "@/domains/payments/transaction-status";

function statusVariant(status: TransactionStatus) {
  if (status === "settled") return "success" as const;
  if (["failed", "rejected", "disputed"].includes(status)) return "danger" as const;
  if (["expired", "cancelled", "reversed", "refunded"].includes(status)) return "warning" as const;
  if (status === "created") return "neutral" as const;
  return "info" as const;
}

export function TransactionDetailView({ detail }: { detail: AdminTransactionDetail }) {
  const { t, locale } = useLocale();
  const { transaction, timeline, ledgerEntries } = detail;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/admin/transactions" className="flex items-center gap-1.5 text-sm text-text-secondary hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("admin.transactions.detail.back")}
      </Link>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{transaction.reference}</CardTitle>
          <Badge variant={statusVariant(transaction.status)}>{t(`transaction.status.${transaction.status}`)}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("history.detail.amount")}</span>
            <span className="font-medium text-text-primary">
              {Number(transaction.amount).toLocaleString(locale)} {transaction.currency}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("history.detail.fee")}</span>
            <span className="font-medium text-text-primary">
              {Number(transaction.fee).toLocaleString(locale)} {transaction.currency}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("history.detail.createdAt")}</span>
            <span className="font-medium text-text-primary">{new Date(transaction.created_at).toLocaleString(locale)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("history.timeline.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border-default">
            {timeline.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text-primary">{t(`transaction.status.${event.to_status}`)}</span>
                  <span className="text-text-secondary">{new Date(event.created_at).toLocaleString(locale)}</span>
                </div>
                {event.reason && <span className="text-xs text-text-secondary">{event.reason}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {ledgerEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.transactions.detail.ledgerEntries")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border-default">
              {ledgerEntries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-primary">{entry.kind} · {entry.direction}</span>
                  <span className="font-medium text-text-primary">
                    {Number(entry.amount).toLocaleString(locale)} {entry.currency}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
