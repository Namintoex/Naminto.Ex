"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminRunReconciliationAction } from "@/domains/reconciliation/admin-actions";
import type { RunReconciliationSummary } from "@/domains/reconciliation";

export function RunReconciliationButton() {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<RunReconciliationSummary | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {summary && (
        <Alert variant="info">
          {t("admin.reconciliation.run.checkedLabel")} {summary.checked} · {t("admin.reconciliation.run.createdLabel")}{" "}
          {summary.anomaliesCreated}
        </Alert>
      )}
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await adminRunReconciliationAction();
            if (result.ok) {
              setSummary(result.summary);
              router.refresh();
            }
          })
        }
        className="self-start"
      >
        {t("admin.reconciliation.run.button")}
      </Button>
    </div>
  );
}
