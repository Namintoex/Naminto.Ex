"use client";

import Link from "next/link";
import { Button, ErrorState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

export function ForbiddenView() {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4">
      <ErrorState
        title={t("admin.forbidden.title")}
        description={t("admin.forbidden.body")}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/">{t("admin.forbidden.backToApp")}</Link>
          </Button>
        }
      />
    </div>
  );
}
