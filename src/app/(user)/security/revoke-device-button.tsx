"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { revokeDeviceAction } from "@/domains/identity/actions";

export function RevokeDeviceButton({ deviceId }: { deviceId: string }) {
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
          await revokeDeviceAction(deviceId);
          router.refresh();
        });
      }}
    >
      {t("security.devices.revoke")}
    </Button>
  );
}
