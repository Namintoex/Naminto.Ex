"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminUpdateTicketStatusAction } from "@/domains/assist/admin-actions";
import type { TicketStatus } from "@/lib/supabase/database.types";

const NEXT_STATUS: Record<TicketStatus, { status: TicketStatus; labelKey: string }[]> = {
  open: [
    { status: "in_progress", labelKey: "admin.support.action.start" },
    { status: "closed", labelKey: "admin.support.action.close" },
  ],
  in_progress: [
    { status: "resolved", labelKey: "admin.support.action.resolve" },
    { status: "closed", labelKey: "admin.support.action.close" },
  ],
  resolved: [
    { status: "closed", labelKey: "admin.support.action.close" },
    { status: "in_progress", labelKey: "admin.support.action.reopen" },
  ],
  closed: [{ status: "open", labelKey: "admin.support.action.reopen" }],
};

export function TicketStatusButtons({ ticketId, current }: { ticketId: string; current: TicketStatus }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: TicketStatus) {
    startTransition(async () => {
      await adminUpdateTicketStatusAction(ticketId, next);
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
