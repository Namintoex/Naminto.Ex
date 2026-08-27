"use client";

import Link from "next/link";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

/** Pagination partagée entre les listes du Back Office (Prompt 22) — même style que history-view.tsx, factorisé pour ne pas le répéter sur chaque module. */
export function AdminPagination({
  page,
  total,
  pageSize,
  buildHref,
}: {
  page: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
}) {
  const { t } = useLocale();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      {page > 1 ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={buildHref(page - 1)}>{t("admin.common.pagination.previous")}</Link>
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled>
          {t("admin.common.pagination.previous")}
        </Button>
      )}
      <span className="text-xs text-text-secondary">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={buildHref(page + 1)}>{t("admin.common.pagination.next")}</Link>
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled>
          {t("admin.common.pagination.next")}
        </Button>
      )}
    </div>
  );
}
