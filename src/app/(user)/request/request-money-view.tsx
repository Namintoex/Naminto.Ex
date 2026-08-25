"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Inbox } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { createMoneyRequestAction } from "@/domains/payments/money-requests/actions";
import { effectiveStatus, type MoneyRequestRow, type MoneyRequestStatus } from "@/domains/payments/money-requests/types";

function statusVariant(status: MoneyRequestStatus) {
  if (status === "fulfilled") return "success" as const;
  if (status === "pending") return "info" as const;
  if (status === "expired") return "warning" as const;
  return "neutral" as const;
}

export function RequestMoneyView({ requests }: { requests: MoneyRequestRow[] }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const parsedAmount = Number(amount.replace(",", "."));
    setError(null);
    startTransition(async () => {
      const result = await createMoneyRequestAction({ amount: parsedAmount, note });
      if (!result.ok) {
        setError(result.errorKey);
        return;
      }
      router.push(`/request/${result.id}`);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("request.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("request.create.section")}</CardTitle>
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
          <Button loading={pending} onClick={submit}>
            {t("request.create.submit")}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-primary">{t("request.list.section")}</h2>
        {requests.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" aria-hidden />}
            title={t("request.list.empty.title")}
            description={t("request.list.empty.body")}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {requests.map((request) => {
              const status = effectiveStatus(request);
              return (
                <Link
                  key={request.id}
                  href={`/request/${request.id}`}
                  className="flex items-center justify-between rounded-md border border-border-default bg-surface-raised p-4 transition-colors hover:bg-surface-sunken"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-text-primary">
                      {Number(request.amount).toLocaleString(locale)} {request.currency}
                    </span>
                    {request.note && <span className="text-xs text-text-secondary">{request.note}</span>}
                  </div>
                  <Badge variant={statusVariant(status)}>{t(`request.status.${status}`)}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
