"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminDispatchDueDeliveriesAction } from "@/domains/event-bus/admin-actions";
import type { DispatchSummary } from "@/domains/event-bus";

export function DispatchDueButton() {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<DispatchSummary | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {summary && (
        <Alert variant="info">
          {t("admin.eventBus.dispatch.checkedLabel")} {summary.checked} · {t("admin.eventBus.dispatch.succeededLabel")}{" "}
          {summary.succeeded} · {t("admin.eventBus.dispatch.deadLetteredLabel")} {summary.deadLettered}
        </Alert>
      )}
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await adminDispatchDueDeliveriesAction();
            if (result.ok) {
              setSummary(result.summary);
              router.refresh();
            }
          })
        }
        className="self-start"
      >
        {t("admin.eventBus.dispatch.button")}
      </Button>
    </div>
  );
}
