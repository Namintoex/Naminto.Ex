"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, QrCode } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { cancelMoneyRequestAction } from "@/domains/payments/money-requests/actions";
import { effectiveStatus, type MoneyRequestRow, type MoneyRequestStatus } from "@/domains/payments/money-requests/types";

function statusVariant(status: MoneyRequestStatus) {
  if (status === "fulfilled") return "success" as const;
  if (status === "pending") return "info" as const;
  if (status === "expired") return "warning" as const;
  return "neutral" as const;
}

export function RequestDetailView({
  request,
  shareLink,
  qrSvg,
}: {
  request: MoneyRequestRow;
  shareLink: string;
  qrSvg: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = effectiveStatus(request);

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelMoneyRequestAction(request.id);
      if (!result.ok) {
        setError(result.errorKey);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/request" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        {t("request.detail.back")}
      </Link>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("request.detail.title")}</CardTitle>
          <Badge variant={statusVariant(status)}>{t(`request.status.${status}`)}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <Alert variant="danger">{t(error)}</Alert>}

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">{t("request.amount.label")}</span>
              <span className="font-medium text-text-primary">
                {Number(request.amount).toLocaleString(locale)} {request.currency}
              </span>
            </div>
            {request.note && (
              <div className="flex justify-between">
                <span className="text-text-secondary">{t("request.detail.note.label")}</span>
                <span className="text-text-primary">{request.note}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-secondary">{t("request.detail.createdAt")}</span>
              <span className="text-text-primary">{new Date(request.created_at).toLocaleString(locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">{t("request.detail.expiresAt")}</span>
              <span className="text-text-primary">{new Date(request.expires_at).toLocaleString(locale)}</span>
            </div>
          </div>

          {status === "pending" && (
            <>
              <div className="flex flex-col items-center gap-3 border-t border-border-default pt-4">
                <QrCode svg={qrSvg} />
                <div className="flex w-full items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-surface-sunken px-3 py-2 text-xs text-text-primary">
                    {shareLink}
                  </code>
                  <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
                    {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  </Button>
                </div>
              </div>

              <Button variant="destructive" loading={pending} onClick={cancel}>
                {t("request.detail.cancel.button")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
