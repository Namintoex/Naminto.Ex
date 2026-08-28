"use client";

import Link from "next/link";
import { ArrowUpFromLine, ChevronRight, Plus, Wallet } from "lucide-react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { WalletBalance } from "@/domains/payments/ledger";
import type { LinkedAccountWithBalance } from "@/domains/accounts/queries";
import { LinkAccountDialog } from "./accounts/link-account-dialog";
import { LinkedAccountCard } from "./accounts/linked-account-card";

function WalletCard({ balances, hasLinkedAccounts }: { balances: WalletBalance[]; hasLinkedAccounts: boolean }) {
  const { t, locale } = useLocale();
  const displayed = balances.length > 0 ? balances : [{ currency: "XOF", balance: 0 }];

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg bg-gradient-to-br from-brand to-brand-hover text-brand-foreground shadow-ds-md transition-all hover:-translate-y-0.5 hover:shadow-ds-lg sm:col-span-2">
      <span
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-125"
        aria-hidden
      />
      <Link href="/send?source=wallet" className="relative flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base font-semibold">
            <Wallet className="size-5" aria-hidden />
            {t("dashboard.wallet.title")}
          </span>
          <ChevronRight
            className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-brand-foreground/80">{t("dashboard.wallet.subtitle")}</span>
          {displayed.map((b) => (
            <span key={b.currency} className="text-3xl font-bold tracking-tight">
              {b.balance.toLocaleString(locale)} {b.currency}
            </span>
          ))}
        </div>
      </Link>
      {hasLinkedAccounts && (
        <div className="relative border-t border-white/15 px-5 py-3">
          <Link
            href="/transfer?direction=withdraw"
            className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-foreground/90 transition-colors hover:bg-white/10"
          >
            <ArrowUpFromLine className="size-3.5" aria-hidden />
            {t("transfer.withdraw.title")}
          </Link>
        </div>
      )}
    </div>
  );
}

export function DashboardView({
  walletBalances,
  linkedAccounts,
}: {
  walletBalances: WalletBalance[];
  linkedAccounts: LinkedAccountWithBalance[];
}) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-text-secondary">{t("dashboard.network.title")}</h2>
        <LinkAccountDialog
          trigger={
            <Button
              size="sm"
              className="size-9 rounded-full p-0 shadow-ds-md hover:scale-105"
              aria-label={t("accounts.link.button")}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <WalletCard balances={walletBalances} hasLinkedAccounts={linkedAccounts.length > 0} />
        {linkedAccounts.map((account) => (
          <LinkedAccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  );
}
