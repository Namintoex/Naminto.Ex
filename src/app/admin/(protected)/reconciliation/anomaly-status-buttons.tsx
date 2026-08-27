"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminUpdateAnomalyStatusAction } from "@/domains/reconciliation/admin-actions";
import type { ReconciliationAnomalyStatus } from "@/lib/supabase/database.types";

const NEXT_STATUS: Record<ReconciliationAnomalyStatus, { status: ReconciliationAnomalyStatus; labelKey: string }[]> = {
  open: [
    { status: "investigating", labelKey: "admin.reconciliation.action.investigate" },
    { status: "closed", labelKey: "admin.reconciliation.action.close" },
  ],
  investigating: [
    { status: "resolved", labelKey: "admin.reconciliation.action.resolve" },
    { status: "open", labelKey: "admin.reconciliation.action.reopen" },
  ],
  resolved: [
    { status: "closed", labelKey: "admin.reconciliation.action.close" },
    { status: "investigating", labelKey: "admin.reconciliation.action.reinvestigate" },
  ],
  closed: [{ status: "investigating", labelKey: "admin.reconciliation.action.reinvestigate" }],
};

export function AnomalyStatusButtons({ anomalyId, current }: { anomalyId: string; current: ReconciliationAnomalyStatus }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: ReconciliationAnomalyStatus) {
    startTransition(async () => {
      await adminUpdateAnomalyStatusAction(anomalyId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {NEXT_STATUS[current].map((option) => (
        <Button key={option.status} size="sm" variant="secondary" loading={pending} onClick={() => apply(option.status)}>
          {t(option.labelKey)}
        </Button>
      ))}
    </div>
  );
}
