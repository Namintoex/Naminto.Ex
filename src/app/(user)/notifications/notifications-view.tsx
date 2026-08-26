"use client";

import { Bell } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { Database } from "@/lib/supabase/database.types";
import { MarkReadButton } from "./mark-read-button";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export function NotificationsView({ notifications }: { notifications: NotificationRow[] }) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("notifications.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-text-secondary" aria-hidden />
            {t("notifications.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <EmptyState title={t("notifications.empty.title")} description={t("notifications.empty.body")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {notifications.map((notification) => (
                <li key={notification.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="font-medium text-text-primary">{notification.title}</span>
                      {!notification.read_at && <Badge variant="info">{t("notifications.unread")}</Badge>}
                    </div>
                    <span className="shrink-0 text-xs text-text-secondary">
                      {new Date(notification.created_at).toLocaleString(locale)}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">{notification.body}</p>
                  {!notification.read_at && (
                    <div>
                      <MarkReadButton notificationId={notification.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
