"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { LedgerAccountWithBalance } from "@/domains/payments/ledger";
import type { Database } from "@/lib/supabase/database.types";

type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];

function ownerLabel(account: LedgerAccountWithBalance): string {
  if (account.owner_type === "user_wallet") return account.owner_id ? `Wallet · ${account.owner_id.slice(0, 8)}` : "Wallet";
  if (account.owner_type === "provider_suspense") return `Suspense · ${account.provider ?? "—"}`;
  if (account.owner_type === "fee_revenue") return "Fee revenue";
  return "External suspense";
}

export function LedgerView({
  accounts,
  entries,
}: {
  accounts: LedgerAccountWithBalance[];
  entries: LedgerEntryRow[];
}) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.ledger")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.ledger.accounts.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState title={t("admin.ledger.accounts.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.ledger.column.owner")}</TableHead>
                  <TableHead>{t("admin.ledger.column.currency")}</TableHead>
                  <TableHead>{t("admin.ledger.column.balance")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{ownerLabel(account)}</TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell>{account.balance.toLocaleString(locale)}</TableCell>
                    <TableCell>
                      <Link href={`/admin/ledger?account=${account.id}`} className="text-xs text-brand hover:underline">
                        {t("admin.ledger.entries.viewAccount")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.ledger.entries.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState title={t("admin.ledger.accounts.empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-primary">
                    {entry.kind} · {entry.direction}
                  </span>
                  <span className="font-medium text-text-primary">
                    {Number(entry.amount).toLocaleString(locale)} {entry.currency}
                  </span>
                  <span className="text-xs text-text-secondary">{new Date(entry.created_at).toLocaleDateString(locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
