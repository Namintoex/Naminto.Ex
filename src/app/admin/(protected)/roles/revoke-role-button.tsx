"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { Badge } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminRevokeRoleAction } from "@/domains/rbac/admin-actions";
import type { AdminRole } from "@/domains/rbac/types";

export function RevokeRoleButton({ userId, role }: { userId: string; role: AdminRole }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Badge variant="neutral" className="flex items-center gap-1 pr-1">
      {t(`admin.roles.role.${role}`)}
      <button
        type="button"
        disabled={pending}
        aria-label={t("admin.roles.revoke")}
        className="rounded-full p-0.5 hover:bg-surface-sunken disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            await adminRevokeRoleAction(userId, role);
            router.refresh();
          })
        }
      >
        <X className="size-3" aria-hidden />
      </button>
    </Badge>
  );
}
