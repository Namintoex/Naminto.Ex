"use client";

import { Plus, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { WalletBalance } from "@/domains/payments/ledger";
import type { LinkedAccountWithBalance } from "@/domains/accounts/queries";
import { LinkAccountDialog } from "./accounts/link-account-dialog";
import { LinkedAccountCard } from "./accounts/linked-account-card";

function WalletCard({ balances }: { balances: WalletBalance[] }) {
  const { t, locale } = useLocale();
  const displayed = balances.length > 0 ? balances : [{ currency: "XOF", balance: 0 }];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-brand" aria-hidden />
          {t("dashboard.wallet.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Wallet className="size-4" aria-hidden />
          {t("dashboard.wallet.subtitle")}
        </div>
        <div className="flex flex-col gap-1">
          {displayed.map((b) => (
            <p key={b.currency} className="text-sm">
              <span className="font-semibold text-text-primary">
                {b.balance.toLocaleString(locale)} {b.currency}
              </span>
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
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
            <Button size="sm" className="size-9 rounded-full p-0" aria-label={t("accounts.link.button")}>
              <Plus className="size-4" aria-hidden />
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <WalletCard balances={walletBalances} />
        {linkedAccounts.map((account) => (
          <LinkedAccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  );
}
