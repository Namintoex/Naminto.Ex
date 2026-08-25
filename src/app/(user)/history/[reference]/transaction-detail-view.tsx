"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Printer } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { TransactionStatus } from "@/domains/payments/transaction-status";
import type { CounterpartyInfo } from "@/domains/payments/history/types";
import type { Database } from "@/lib/supabase/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type StatusEventRow = Database["public"]["Tables"]["transaction_status_events"]["Row"];
type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];

function statusVariant(status: TransactionStatus) {
  if (status === "settled") return "success" as const;
  if (["failed", "rejected", "disputed"].includes(status)) return "danger" as const;
  if (["expired", "cancelled", "reversed", "refunded"].includes(status)) return "warning" as const;
  if (status === "created") return "neutral" as const;
  return "info" as const;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className={strong ? "font-medium text-text-primary" : "text-text-primary"}>{value}</span>
    </div>
  );
}

export function TransactionDetailView({
  tx,
  timeline,
  ledgerEntries,
  counterparty,
  direction,
}: {
  tx: TransactionRow;
  timeline: StatusEventRow[];
  ledgerEntries: LedgerEntryRow[];
  counterparty: CounterpartyInfo;
  direction: "sent" | "received";
}) {
  const { t, locale } = useLocale();

  const amount = Number(tx.amount);
  const fee = Number(tx.fee);
  // Reflète exactement le calcul du Ledger (recordSettlement,
  // src/domains/payments/ledger/record-entries.ts) plutôt que la colonne
  // `total` — celle-ci vaut toujours amount + fee, y compris quand
  // fee_payer = 'recipient' (elle prédate le Fee Payer, Prompt 10-13) et
  // ne représenterait donc pas fidèlement ce que le Ledger a réellement
  // débité/crédité. Voir docs/DECISIONS.md ADR-044.
  const senderDebit = tx.fee_payer === "sender" ? round2(amount + fee) : amount;
  const recipientCredit = tx.fee_payer === "recipient" ? round2(amount - fee) : amount;

  const counterpartyLabel =
    counterparty.kind === "own_linked_account" ? t("history.list.counterparty.ownAccount") : counterparty.label;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 print:max-w-full print:px-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/history" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="size-4" aria-hidden />
          {t("history.detail.back")}
        </Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          {t("history.receipt.print")}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{tx.reference}</CardTitle>
          <Badge variant={statusVariant(tx.status)}>{t(`transaction.status.${tx.status}`)}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <SummaryRow
            label={t("history.detail.counterparty")}
            value={`${t(`history.direction.${direction}`)} — ${counterpartyLabel}`}
          />
          <SummaryRow label={t("history.detail.amount")} value={`${amount.toLocaleString(locale)} ${tx.currency}`} />
          <SummaryRow label={t("history.detail.fee")} value={`${fee.toLocaleString(locale)} ${tx.currency}`} />
          <SummaryRow
            label={t("history.detail.feePayer")}
            value={t(tx.fee_payer === "sender" ? "send.feePayer.sender" : "send.feePayer.recipient")}
          />
          <SummaryRow
            label={t("history.detail.senderDebit")}
            value={`${senderDebit.toLocaleString(locale)} ${tx.currency}`}
            strong
          />
          <SummaryRow
            label={t("history.detail.recipientCredit")}
            value={`${recipientCredit.toLocaleString(locale)} ${tx.currency}`}
          />
          <SummaryRow label={t("history.detail.createdAt")} value={new Date(tx.created_at).toLocaleString(locale)} />
          <SummaryRow label={t("history.detail.updatedAt")} value={new Date(tx.updated_at).toLocaleString(locale)} />
          {tx.provider_transaction_id && (
            <SummaryRow label={t("history.detail.providerTransactionId")} value={tx.provider_transaction_id} />
          )}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{t("history.timeline.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {timeline.map((event) => (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-medium text-text-primary">
                    {event.from_status ? `${t(`transaction.status.${event.from_status}`)} → ` : ""}
                    {t(`transaction.status.${event.to_status}`)}
                  </span>
                  <span className="text-xs text-text-secondary">{new Date(event.created_at).toLocaleString(locale)}</span>
                  {event.reason && <span className="text-xs text-text-secondary">{event.reason}</span>}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("history.receipt.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {t("history.receipt.brand")}
          </p>
          <div className="flex flex-col gap-1 text-sm">
            <SummaryRow label={t("history.detail.reference")} value={tx.reference} />
            <SummaryRow label={t("history.detail.status")} value={t(`transaction.status.${tx.status}`)} />
            <SummaryRow
              label={t("history.detail.senderDebit")}
              value={`${senderDebit.toLocaleString(locale)} ${tx.currency}`}
              strong
            />
            <SummaryRow
              label={t("history.detail.recipientCredit")}
              value={`${recipientCredit.toLocaleString(locale)} ${tx.currency}`}
            />
          </div>
          {ledgerEntries.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {t("history.receipt.confirmedByLedger")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
