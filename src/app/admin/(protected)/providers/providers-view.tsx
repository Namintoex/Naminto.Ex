"use client";

import { Badge, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminProviderSummary } from "@/domains/providers/admin-queries";
import type { Provider } from "@/lib/supabase/database.types";

const PROVIDER_LABEL_KEY: Record<Provider, string> = {
  orange: "provider.orange",
  mtn: "provider.mtn",
  moov: "provider.moov",
  wave: "provider.wave",
  prepaid_card: "provider.prepaidCard",
};

function healthVariant(status: string) {
  if (status === "operational") return "success" as const;
  if (status === "degraded") return "warning" as const;
  return "danger" as const;
}

export function ProvidersView({ providers }: { providers: AdminProviderSummary[] }) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.providers")}</h1>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.providers.column.provider")}</TableHead>
                <TableHead>{t("admin.providers.column.mode")}</TableHead>
                <TableHead>{t("admin.providers.column.health")}</TableHead>
                <TableHead>{t("admin.providers.column.transactions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.provider}>
                  <TableCell className="font-medium text-text-primary">{t(PROVIDER_LABEL_KEY[p.provider])}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">{p.mode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={healthVariant(p.health.status)}>{p.health.status}</Badge>
                  </TableCell>
                  <TableCell>{p.transactionCount.toLocaleString(locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
