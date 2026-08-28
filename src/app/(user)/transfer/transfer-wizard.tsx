"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, EmptyState, Input, Spinner } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { getProviderConfig, maskExternalReference } from "@/domains/accounts/providers";
import { previewFeeAction, sendMoneyAction, type FeePreviewResult, type SendMoneyResult } from "@/domains/payments/actions";
import type { Provider } from "@/lib/supabase/database.types";
import type { WalletBalance } from "@/domains/payments/ledger";
import { StepShell, SummaryRow } from "../send/step-shell";

type LinkedAccountOption = { id: string; provider: Provider; externalReference: string };
type Direction = "deposit" | "withdraw";
type Step = "account" | "amount" | "pin" | "recap" | "result";

const STEP_ORDER: Step[] = ["account", "amount", "pin", "recap"];

function ChoiceCard({
  selected,
  title,
  body,
  onSelect,
}: {
  selected: boolean;
  title: string;
  body: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors ${
        selected
          ? "border-brand bg-brand/5 ring-1 ring-brand"
          : "border-border-default bg-surface-raised hover:bg-surface-sunken"
      }`}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <span className="text-xs text-text-secondary">{body}</span>
      </span>
    </button>
  );
}

export function TransferWizard({
  direction,
  linkedAccounts,
  initialAccountId,
  walletBalances,
}: {
  direction: Direction;
  linkedAccounts: LinkedAccountOption[];
  initialAccountId: string | null;
  walletBalances: WalletBalance[];
}) {
  const { t, locale } = useLocale();

  const [step, setStep] = useState<Step>(initialAccountId ? "amount" : "account");
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const account = linkedAccounts.find((a) => a.id === accountId) ?? null;

  const [amountInput, setAmountInput] = useState("");
  const [feePreview, setFeePreview] = useState<FeePreviewResult | null>(null);
  const [previewPending, startPreview] = useTransition();

  const [pin, setPin] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const [submitPending, startSubmit] = useTransition();
  const [result, setResult] = useState<SendMoneyResult | null>(null);

  const amount = Number(amountInput.replace(",", "."));
  const walletBalance = walletBalances.find((b) => b.currency === "XOF")?.balance ?? 0;

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }

  function runFeePreview(nextAmount: number) {
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setFeePreview(null);
      return;
    }
    startPreview(async () => {
      setFeePreview(
        await previewFeeAction({
          amount: nextAmount,
          sourceType: direction === "deposit" ? "linked_account" : "naminto_wallet",
          destinationType: direction === "deposit" ? "naminto_wallet" : "linked_account",
          provider: account?.provider ?? null,
          feePayer: "sender",
        })
      );
    });
  }

  function goToRecap() {
    setIdempotencyKey((current) => current ?? crypto.randomUUID());
    setStep("recap");
  }

  function submit() {
    if (!idempotencyKey || !feePreview?.ok || !accountId) return;
    startSubmit(async () => {
      const recipient =
        direction === "deposit"
          ? ({ mode: "deposit" as const, linkedAccountId: accountId })
          : ({ mode: "withdraw" as const, linkedAccountId: accountId });
      const res = await sendMoneyAction({ idempotencyKey, amount, feePayer: "sender", pin, recipient });
      setResult(res);
      setStep("result");
    });
  }

  function resetAll() {
    setStep(initialAccountId ? "amount" : "account");
    setAccountId(initialAccountId);
    setAmountInput("");
    setFeePreview(null);
    setPin("");
    setIdempotencyKey(null);
    setResult(null);
  }

  const title = t(direction === "deposit" ? "transfer.deposit.title" : "transfer.withdraw.title");
  const Icon = direction === "deposit" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
        <Icon className="size-5" aria-hidden />
        {title}
      </h1>

      {step === "account" && (
        <StepShell title={t("transfer.step.account.title")} backLabel={t("send.nav.back")}>
          {linkedAccounts.length === 0 ? (
            <EmptyState
              title={t("send.linkedAccount.empty.title")}
              description={t("send.linkedAccount.empty.body")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/accounts">{t("send.linkedAccount.empty.cta")}</Link>
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {linkedAccounts.map((a) => {
                const config = getProviderConfig(a.provider);
                return (
                  <ChoiceCard
                    key={a.id}
                    selected={accountId === a.id}
                    onSelect={() => setAccountId(a.id)}
                    title={t(config.labelKey)}
                    body={maskExternalReference(a.externalReference)}
                  />
                );
              })}
            </div>
          )}
          <Button disabled={!accountId} onClick={() => setStep("amount")}>
            {t("send.nav.next")}
          </Button>
        </StepShell>
      )}

      {step === "amount" && account && (
        <StepShell
          title={t("send.step.amount.title")}
          onBack={initialAccountId ? undefined : goBack}
          backLabel={t("send.nav.back")}
        >
          <p className="text-sm text-text-secondary">
            {t(direction === "deposit" ? "transfer.amount.fromAccount" : "transfer.amount.toAccount")}{" "}
            <span className="font-medium text-text-primary">{t(getProviderConfig(account.provider).labelKey)}</span>
          </p>
          {direction === "withdraw" && (
            <p className="text-xs text-text-secondary">
              {t("dashboard.wallet.title")}: {walletBalance.toLocaleString(locale)} XOF
            </p>
          )}
          <Input
            label={t("send.amount.label")}
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => {
              const next = e.target.value;
              setAmountInput(next);
              runFeePreview(Number(next.replace(",", ".")));
            }}
            errorText={amountInput && !(amount > 0) ? t("send.amount.error.invalid") : undefined}
          />

          {previewPending && <Spinner label={t("send.executing")} />}
          {!previewPending && feePreview?.ok && (
            <div className="flex flex-col gap-1 rounded-md bg-surface-sunken p-3 text-sm">
              <SummaryRow label={t("send.fee.preview.fee")} value={`${feePreview.fee.toLocaleString(locale)} XOF`} />
              <SummaryRow
                label={t("send.fee.preview.senderDebit")}
                value={`${feePreview.senderDebit.toLocaleString(locale)} XOF`}
                strong
              />
            </div>
          )}
          {!previewPending && amount > 0 && feePreview && !feePreview.ok && (
            <Alert variant="warning">{t("send.fee.preview.unavailable")}</Alert>
          )}

          <Button disabled={!feePreview?.ok} onClick={() => setStep("pin")}>
            {t("send.nav.next")}
          </Button>
        </StepShell>
      )}

      {step === "pin" && (
        <StepShell title={t("send.step.pin.title")} onBack={goBack} backLabel={t("send.nav.back")}>
          <p className="text-sm text-text-secondary">{t("send.pin.body")}</p>
          <Input
            type="password"
            inputMode="numeric"
            label={t("send.pin.label")}
            pattern="\d{6}"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <Button disabled={!/^\d{6}$/.test(pin)} onClick={goToRecap}>
            {t("send.nav.next")}
          </Button>
        </StepShell>
      )}

      {step === "recap" && feePreview?.ok && account && (
        <StepShell title={t("send.step.recap.title")} onBack={goBack} backLabel={t("send.nav.back")}>
          <div className="flex flex-col gap-1 text-sm">
            <SummaryRow label={title} value={t(getProviderConfig(account.provider).labelKey)} />
            <SummaryRow label={t("send.recap.amount")} value={`${amount.toLocaleString(locale)} XOF`} />
            <SummaryRow label={t("send.recap.fee")} value={`${feePreview.fee.toLocaleString(locale)} XOF`} />
            <SummaryRow
              label={t("send.recap.total")}
              value={`${feePreview.senderDebit.toLocaleString(locale)} XOF`}
              strong
            />
          </div>

          <Alert variant="warning">{t("send.recap.disclaimer")}</Alert>

          <Button loading={submitPending} onClick={submit}>
            {t("send.recap.confirm")}
          </Button>
        </StepShell>
      )}

      {step === "result" && result && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            {result.ok ? (
              <>
                <CheckCircle2 className="size-10 text-success" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-text-primary">{t("send.result.success.title")}</p>
                  <p className="text-sm text-text-secondary">{t("send.result.success.body")}</p>
                </div>
                <Badge variant="neutral">
                  {t("send.result.success.reference")}: {result.reference}
                </Badge>
                <div className="flex w-full gap-2">
                  <Button variant="secondary" className="flex-1" onClick={resetAll}>
                    {t("send.result.newTransfer")}
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/">{t("send.result.backHome")}</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Alert variant="danger" title={t("send.result.error.title")}>
                  {t(result.errorKey)}
                </Alert>
                <div className="flex w-full gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setStep("recap")}>
                    {t("send.result.retry")}
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={resetAll}>
                    {t("send.nav.cancel")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
