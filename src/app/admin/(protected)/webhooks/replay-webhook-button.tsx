"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminReplayWebhookEventAction } from "@/domains/webhooks/admin-actions";

export function ReplayWebhookButton({ eventRowId }: { eventRowId: string }) {
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
          await adminReplayWebhookEventAction(eventRowId);
          router.refresh();
        })
      }
    >
      {t("admin.webhooks.action.replay")}
    </Button>
  );
}
