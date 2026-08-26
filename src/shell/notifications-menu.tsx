"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { Database } from "@/lib/supabase/database.types";

type NotificationRow = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "title" | "body" | "read_at" | "created_at"
>;

const DROPDOWN_LIMIT = 5;

export function NotificationsMenu({ notifications = [] }: { notifications?: NotificationRow[] }) {
  const { t, locale } = useLocale();
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const preview = notifications.slice(0, DROPDOWN_LIMIT);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("notifications.title")} className="relative">
          <Bell className="size-4" aria-hidden />
          {unreadCount > 0 && (
            <Badge variant="danger" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-sm font-semibold text-text-primary">
          {t("notifications.title")}
        </div>
        {preview.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
            <p className="text-sm font-medium text-text-primary">
              {t("notifications.empty.title")}
            </p>
            <p className="text-xs text-text-secondary">{t("notifications.empty.body")}</p>
          </div>
        ) : (
          <>
            <ul className="flex max-h-80 flex-col divide-y divide-border-default overflow-y-auto">
              {preview.map((notification) => (
                <li key={notification.id} className="flex flex-col gap-0.5 px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    {!notification.read_at && <span className="size-1.5 shrink-0 rounded-full bg-brand" />}
                    <span className="truncate text-sm font-medium text-text-primary">
                      {notification.title}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-text-secondary">{notification.body}</p>
                  <p className="text-[10px] text-text-secondary">
                    {new Date(notification.created_at).toLocaleString(locale)}
                  </p>
                </li>
              ))}
            </ul>
            <Link
              href="/notifications"
              className="block px-2 py-2 text-center text-xs font-medium text-brand hover:underline"
            >
              {t("notifications.viewAll")}
            </Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
