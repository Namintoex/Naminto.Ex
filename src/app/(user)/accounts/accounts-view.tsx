"use client";

import { Link2Off } from "lucide-react";
import { EmptyState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { LinkedAccountWithBalance } from "@/domains/accounts/queries";
import { LinkAccountDialog } from "./link-account-dialog";
import { LinkedAccountCard } from "./linked-account-card";

export function AccountsView({ accounts }: { accounts: LinkedAccountWithBalance[] }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-text-primary">{t("accounts.title")}</h1>
        <LinkAccountDialog />
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Link2Off className="size-5" aria-hidden />}
          title={t("accounts.empty.title")}
          description={t("accounts.empty.body")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <LinkedAccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
