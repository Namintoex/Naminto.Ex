"use client";

import { XCircle } from "lucide-react";
import { Card, CardContent } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { QrVerifyFailureReason } from "@/domains/qr-engine/types";

const REASON_KEYS: Record<QrVerifyFailureReason, string> = {
  malformed: "qr.error.malformed",
  invalid_signature: "qr.error.invalidSignature",
  invalid_payload: "qr.error.invalidPayload",
  expired: "qr.error.expired",
};

export function QrErrorView({ reason }: { reason: QrVerifyFailureReason }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <XCircle className="size-10 text-danger" aria-hidden />
          <p className="text-base font-semibold text-text-primary">{t(REASON_KEYS[reason])}</p>
        </CardContent>
      </Card>
    </div>
  );
}
