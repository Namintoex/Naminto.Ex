"use client";

import { Construction } from "lucide-react";
import { EmptyState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

export function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t(titleKey)}</h1>
      <EmptyState
        icon={<Construction className="size-5" aria-hidden />}
        title={t("comingSoon.title")}
        description={t("comingSoon.body")}
      />
    </div>
  );
}
