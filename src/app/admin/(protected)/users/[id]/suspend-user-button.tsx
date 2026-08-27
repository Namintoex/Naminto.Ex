"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminSetUserSuspendedAction } from "@/domains/identity/admin-actions";
import type { IdentityStatus } from "@/lib/supabase/database.types";

export function SuspendUserButton({ userId, status }: { userId: string; status: IdentityStatus }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suspended = status === "suspended";

  return (
    <Button
      variant={suspended ? "secondary" : "destructive"}
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await adminSetUserSuspendedAction(userId, !suspended);
          router.refresh();
        })
      }
    >
      {t(suspended ? "admin.users.action.reactivate" : "admin.users.action.suspend")}
    </Button>
  );
}
