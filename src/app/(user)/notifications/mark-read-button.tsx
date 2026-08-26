"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { markNotificationReadAction } from "@/domains/notifications/actions";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() => {
        startTransition(async () => {
          await markNotificationReadAction(notificationId);
          router.refresh();
        });
      }}
    >
      {t("notifications.markRead")}
    </Button>
  );
}
