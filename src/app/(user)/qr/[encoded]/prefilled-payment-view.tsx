"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { payPrefilledQrAction } from "@/domains/qr-engine/actions";
import type { PrefilledPaymentQrPayload } from "@/domains/qr-engine/types";

export function PrefilledPaymentView({
  raw,
  payload,
  recipientName,
  isSelf,
}: {
  raw: string;
  payload: PrefilledPaymentQrPayload;
  recipientName: string;
  isSelf: boolean;
}) {
  const { t, locale } = useLocale();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await payPrefilledQrAction({ raw, pin });
      if (!result.ok) {
        setError(result.errorKey);
        return;
      }
      setReference(result.reference);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("qr.prefilled.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            {recipientName} {t("pay.requester.prefix")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">{t("request.amount.label")}</span>
              <span className="text-2xl font-semibold text-text-primary">
                {payload.amount.toLocaleString(locale)} {payload.currency}
              </span>
            </div>
            {payload.note && (
              <div className="flex justify-between pt-1">
                <span className="text-text-secondary">{t("pay.note.label")}</span>
                <span className="text-text-primary">{payload.note}</span>
              </div>
            )}
          </div>

          {reference ? (
            <div className="flex flex-col items-center gap-3 border-t border-border-default pt-4 text-center">
              <CheckCircle2 className="size-10 text-success" aria-hidden />
              <div>
                <p className="text-base font-semibold text-text-primary">{t("pay.success.title")}</p>
                <p className="text-sm text-text-secondary">{t("pay.success.body")}</p>
              </div>
              <Badge variant="neutral">{reference}</Badge>
            </div>
          ) : isSelf ? (
            <Alert variant="info">{t("pay.self.notice")}</Alert>
          ) : (
            <div className="flex flex-col gap-4 border-t border-border-default pt-4">
              {error && <Alert variant="danger">{t(error)}</Alert>}
              <Input
                type="password"
                inputMode="numeric"
                label={t("pay.pin.label")}
                pattern="\d{6}"
                maxLength={6}
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
              <Button loading={pending} disabled={!/^\d{6}$/.test(pin)} onClick={submit}>
                {t("pay.confirm.button")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
