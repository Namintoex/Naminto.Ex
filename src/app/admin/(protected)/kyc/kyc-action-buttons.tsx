"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminUpdateKycStatusAction } from "@/domains/identity/admin-actions";
import type { KycStatus } from "@/lib/supabase/database.types";

export function KycActionButtons({ userId, current }: { userId: string; current: KycStatus }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: KycStatus) {
    startTransition(async () => {
      await adminUpdateKycStatusAction(userId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="secondary" loading={pending} disabled={current === "verified"} onClick={() => apply("verified")}>
        {t("admin.kyc.action.approve")}
      </Button>
      <Button size="sm" variant="secondary" loading={pending} disabled={current === "rejected"} onClick={() => apply("rejected")}>
        {t("admin.kyc.action.reject")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        disabled={current === "requires_action"}
        onClick={() => apply("requires_action")}
      >
        {t("admin.kyc.action.requestAction")}
      </Button>
    </div>
  );
}
