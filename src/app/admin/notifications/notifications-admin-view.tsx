"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminRetryDeliveryAction } from "@/domains/notifications/admin-actions";
import type { AdminNotificationRow, DeliveryStatusBreakdown } from "@/domains/notifications";
import { AdminPagination } from "../admin-pagination";

function statusVariant(status: string) {
  if (status === "SENT") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  return "neutral" as const;
}

function RetryButton({ deliveryId }: { deliveryId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await adminRetryDeliveryAction(deliveryId);
          router.refresh();
        })
      }
    >
      {t("admin.notifications.action.retry")}
    </Button>
  );
}

export function NotificationsAdminView({
  result,
  breakdown,
}: {
  result: { notifications: AdminNotificationRow[]; total: number; page: number; pageSize: number };
  breakdown: DeliveryStatusBreakdown[];
}) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.notifications")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.notifications.deliveries.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {breakdown.map((b) => (
            <Badge key={`${b.channel}-${b.status}`} variant={statusVariant(b.status)}>
              {b.channel} · {t(`admin.notifications.status.${b.status}`)} · {b.count}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {result.notifications.length === 0 ? (
        <EmptyState title={t("admin.notifications.empty")} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {result.notifications.map((notification) => (
              <li key={notification.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">{notification.title}</span>
                        <span className="text-xs text-text-secondary">
                          {notification.event_type} · {new Date(notification.created_at).toLocaleString(locale)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {notification.deliveries.map((delivery) => (
                        <div key={delivery.id} className="flex items-center gap-1.5">
                          <Badge variant={statusVariant(delivery.status)}>
                            {delivery.channel} · {t(`admin.notifications.status.${delivery.status}`)}
                          </Badge>
                          {delivery.status === "FAILED" && <RetryButton deliveryId={delivery.id} />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <AdminPagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(p) => `/admin/notifications?page=${p}`}
          />
        </>
      )}
    </div>
  );
}
