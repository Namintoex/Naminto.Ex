"use client";

import { CreditCard, Link2Off } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { getProviderConfig, maskExternalReference } from "@/domains/accounts/providers";
import type { Database } from "@/lib/supabase/database.types";
import { LinkAccountDialog } from "./link-account-dialog";
import { UnlinkButton } from "./unlink-button";

type LinkedAccount = Pick<
  Database["public"]["Tables"]["linked_accounts"]["Row"],
  "id" | "provider" | "external_reference" | "status" | "consent_status" | "linked_at"
>;

function statusVariant(status: LinkedAccount["status"]) {
  if (status === "active") return "success" as const;
  if (status === "connection_expired" || status === "verification_required") return "warning" as const;
  if (status === "suspended" || status === "provider_unavailable") return "danger" as const;
  return "neutral" as const;
}

export function AccountsView({ accounts }: { accounts: LinkedAccount[] }) {
  const { t, locale } = useLocale();

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
          {accounts.map((account) => {
            const config = getProviderConfig(account.provider);
            return (
              <Card key={account.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${config.dotClassName}`} aria-hidden />
                    {t(config.labelKey)}
                  </CardTitle>
                  <Badge variant={statusVariant(account.status)}>
                    {t(`accounts.status.${account.status}`)}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <CreditCard className="size-4" aria-hidden />
                    {maskExternalReference(account.external_reference)}
                  </div>
                  <p className="text-xs text-text-secondary">
                    {t("accounts.balance.unavailable")}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t("accounts.linkedSince")}{" "}
                    {new Date(account.linked_at).toLocaleDateString(locale)}
                  </p>
                  <div className="mt-1">
                    <UnlinkButton accountId={account.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
