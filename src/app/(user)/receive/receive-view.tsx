"use client";

import { useState, useTransition } from "react";
import { Check, Copy, QrCode as QrCodeIcon } from "lucide-react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, QrCode } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { generatePrefilledQrAction } from "@/domains/qr-engine/actions";

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

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ shareLink: string; qrSvg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function copy() {
    await navigator.clipboard.writeText(namintoId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function generate() {
    setError(null);
    setGenerated(null);
    const parsedAmount = Number(amount.replace(",", "."));
    startTransition(async () => {
      const result = await generatePrefilledQrAction({ amount: parsedAmount, note });
      if (!result.ok) {
        setError(result.errorKey);
        return;
      }
      setGenerated({ shareLink: result.shareLink, qrSvg: result.qrSvg });
    });
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
            {t("receive.qr.scanHint")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("receive.prefilled.section")}</CardTitle>
          <p className="text-sm text-text-secondary">{t("receive.prefilled.body")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          <Input
            label={t("request.amount.label")}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            label={t("request.note.label")}
            placeholder={t("request.note.placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
          />
          <Button loading={pending} onClick={generate}>
            {t("receive.prefilled.generate")}
          </Button>

          {generated && (
            <div className="flex flex-col items-center gap-3 border-t border-border-default pt-4">
              <QrCode svg={generated.qrSvg} />
              <code className="w-full truncate rounded-md bg-surface-sunken px-3 py-2 text-xs text-text-primary">
                {generated.shareLink}
              </code>
              <p className="text-xs text-text-secondary">{t("receive.prefilled.expiry")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
