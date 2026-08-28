"use client";

import { CreditCard } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { getProviderConfig, maskExternalReference } from "@/domains/accounts/providers";
import type { LinkedAccountWithBalance } from "@/domains/accounts/queries";
import { UnlinkButton } from "./unlink-button";

function statusVariant(status: LinkedAccountWithBalance["status"]) {
  if (status === "active") return "success" as const;
  if (status === "connection_expired" || status === "verification_required") return "warning" as const;
  if (status === "suspended" || status === "provider_unavailable") return "danger" as const;
  return "neutral" as const;
}

/** Carte d'un compte lié — factorisée pour être réutilisée par `/accounts` et le tableau de bord. */
export function LinkedAccountCard({ account }: { account: LinkedAccountWithBalance }) {
  const { t, locale } = useLocale();
  const config = getProviderConfig(account.provider);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${config.dotClassName}`} aria-hidden />
          {t(config.labelKey)}
        </CardTitle>
        <Badge variant={statusVariant(account.status)}>{t(`accounts.status.${account.status}`)}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <CreditCard className="size-4" aria-hidden />
          {maskExternalReference(account.external_reference)}
        </div>
        {account.balance ? (
          <p className="text-sm">
            <span className="text-text-secondary">{t("accounts.balance.sandboxLabel")}: </span>
            <span className="font-semibold text-text-primary">
              {account.balance.amount.toLocaleString(locale)} {account.balance.currency}
            </span>
          </p>
        ) : (
          <p className="text-xs text-text-secondary">{t("accounts.balance.unavailable")}</p>
        )}
        <p className="text-xs text-text-secondary">
          {t("accounts.linkedSince")} {new Date(account.linked_at).toLocaleDateString(locale)}
        </p>
        <div className="mt-1">
          <UnlinkButton accountId={account.id} />
        </div>
      </CardContent>
    </Card>
  );
}
