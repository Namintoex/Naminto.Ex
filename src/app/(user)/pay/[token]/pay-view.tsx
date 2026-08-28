"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { payMoneyRequestAction } from "@/domains/payments/money-requests/actions";
import { effectiveStatus, type PublicMoneyRequestView, type MoneyRequestStatus } from "@/domains/payments/money-requests/types";

function statusVariant(status: MoneyRequestStatus) {
  if (status === "fulfilled") return "success" as const;
  if (status === "pending") return "info" as const;
  if (status === "expired") return "warning" as const;
  return "neutral" as const;
}

export function PayView({
  request,
  requesterName,
  isSelf,
}: {
  request: PublicMoneyRequestView;
  requesterName: string;
  isSelf: boolean;
}) {
  const { t, locale } = useLocale();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = effectiveStatus(request);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await payMoneyRequestAction({ token: request.token, pin });
      if (!result.ok) {
        setError(result.errorKey);
        return;
      }
      setReference(result.reference);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("pay.title")}</h1>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {requesterName} {t("pay.requester.prefix")}
          </CardTitle>
          <Badge variant={statusVariant(status)}>{t(`request.status.${status}`)}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">{t("request.amount.label")}</span>
              <span className="text-2xl font-semibold text-text-primary">
                {Number(request.amount).toLocaleString(locale)} {request.currency}
              </span>
            </div>
            {request.note && (
              <div className="flex justify-between pt-1">
                <span className="text-text-secondary">{t("pay.note.label")}</span>
                <span className="text-text-primary">{request.note}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-secondary">{t("pay.expiresAt.label")}</span>
              <span className="text-text-primary">{new Date(request.expires_at).toLocaleString(locale)}</span>
            </div>
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
          ) : status === "pending" ? (
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
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
