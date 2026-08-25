"use client";

import { useState } from "react";
import { Check, Copy, QrCode as QrCodeIcon } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, QrCode } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

export function ReceiveView({
  namintoId,
  legalName,
  qrSvg,
}: {
  namintoId: string;
  legalName: string;
  qrSvg: string;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(namintoId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("receive.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{legalName}</CardTitle>
          <p className="text-sm text-text-secondary">{t("receive.subtitle")}</p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <QrCode svg={qrSvg} />

          <div className="flex w-full flex-col gap-1.5">
            <p className="text-xs font-medium text-text-secondary">{t("receive.namintoId.label")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-surface-sunken px-3 py-2 text-sm text-text-primary">
                {namintoId}
              </code>
              <Button type="button" variant="secondary" size="sm" onClick={copy}>
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? t("receive.copy.done") : t("receive.copy.button")}
              </Button>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-text-secondary">
            <QrCodeIcon className="size-3.5" aria-hidden />
            {t("receive.qr.comingSoon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
