"use client";

import { Bell } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

export function NotificationsMenu() {
  const { t } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("notifications.title")}>
          <Bell className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-sm font-semibold text-text-primary">
          {t("notifications.title")}
        </div>
        <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
          <p className="text-sm font-medium text-text-primary">
            {t("notifications.empty.title")}
          </p>
          <p className="text-xs text-text-secondary">{t("notifications.empty.body")}</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
