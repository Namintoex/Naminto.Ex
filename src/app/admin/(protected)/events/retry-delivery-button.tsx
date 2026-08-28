"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminRetryDeliveryAction } from "@/domains/event-bus/admin-actions";

export function RetryDeliveryButton({ deliveryId }: { deliveryId: string }) {
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
      {t("admin.eventBus.action.retry")}
    </Button>
  );
}
