"use client";

import Link from "next/link";
import { ArrowDownToLine, ChevronRight, CreditCard } from "lucide-react";
import { Badge, Card } from "@/design-system";
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

/**
 * Carte d'un compte lié — factorisée pour être réutilisée par `/accounts`
 * et le tableau de bord. Cliquable (comme le bouton "Envoyer") : mène
 * directement à Send Money avec ce compte déjà choisi comme source —
 * jamais imbriquée dans un `<Link>` pour autant, "Délier" reste un
 * bouton indépendant en dehors de la zone cliquable (deux éléments
 * interactifs imbriqués seraient invalides en HTML).
 */
export function LinkedAccountCard({ account }: { account: LinkedAccountWithBalance }) {
  const { t, locale } = useLocale();
  const config = getProviderConfig(account.provider);
  const clickable = account.status === "active";

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-ds-md">
      <Link
        href={clickable ? `/send?source=${account.id}` : "#"}
        aria-disabled={!clickable}
        className={`flex flex-1 flex-col gap-3 p-5 ${clickable ? "cursor-pointer" : "pointer-events-none"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <span className={`size-2.5 rounded-full ${config.dotClassName}`} aria-hidden />
            {t(config.labelKey)}
          </span>
          <Badge variant={statusVariant(account.status)}>{t(`accounts.status.${account.status}`)}</Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <CreditCard className="size-4" aria-hidden />
          {maskExternalReference(account.external_reference)}
        </div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            {account.balance ? (
              <p className="text-sm">
                <span className="text-text-secondary">{t("accounts.balance.sandboxLabel")}: </span>
                <span className="text-lg font-semibold text-text-primary">
                  {account.balance.amount.toLocaleString(locale)} {account.balance.currency}
                </span>
              </p>
            ) : (
              <p className="text-xs text-text-secondary">{t("accounts.balance.unavailable")}</p>
            )}
            <p className="text-xs text-text-secondary">
              {t("accounts.linkedSince")} {new Date(account.linked_at).toLocaleDateString(locale)}
            </p>
          </div>
          {clickable && (
            <ChevronRight
              className="size-5 shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden
            />
          )}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-border-default px-5 py-3">
        {clickable ? (
          <Link
            href={`/transfer?direction=deposit&account=${account.id}`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
          >
            <ArrowDownToLine className="size-3.5" aria-hidden />
            {t("transfer.deposit.title")}
          </Link>
        ) : (
          <span />
        )}
        <UnlinkButton accountId={account.id} />
      </div>
    </Card>
  );
}
