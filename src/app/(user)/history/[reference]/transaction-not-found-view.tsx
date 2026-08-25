"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

export function TransactionNotFoundView() {
  const { t } = useLocale();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <EmptyState
        icon={<SearchX className="size-5" aria-hidden />}
        title={t("history.detail.notFound.title")}
        description={t("history.detail.notFound.body")}
        action={
          <Link href="/history" className="text-sm text-brand hover:underline">
            {t("history.detail.back")}
          </Link>
        }
      />
    </div>
  );
}
