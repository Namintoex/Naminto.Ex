"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, QrCode, Smartphone, Wallet } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Spinner,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { getProviderConfig, maskExternalReference } from "@/domains/accounts/providers";
import {
  lookupRecipientAction,
  previewFeeAction,
  sendMoneyAction,
  type FeePreviewResult,
  type RecipientLookupResult,
  type SendMoneyResult,
} from "@/domains/payments/actions";
import type { FeePayer, Provider } from "@/lib/supabase/database.types";

type LinkedAccountOption = {
  id: string;
  provider: Provider;
  externalReference: string;
};

type RecipientMode = "internal" | "external";
type Step = "recipientType" | "recipientDetails" | "amount" | "pin" | "recap" | "result";

const STEP_ORDER: Step[] = ["recipientType", "recipientDetails", "amount", "pin", "recap"];

function ChoiceCard({
  selected,
  title,
  body,
  icon,
  onSelect,
}: {
  selected: boolean;
  title: string;
  body: string;
  icon: ReactNode;
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
      <span className="mt-0.5 text-brand">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <span className="text-xs text-text-secondary">{body}</span>
      </span>
    </button>
  );
}

function StepShell({
  title,
  onBack,
  backLabel,
  children,
}: {
  title: string;
  onBack?: () => void;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="rounded-md p-1 text-text-secondary hover:bg-surface-sunken"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
        )}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className={strong ? "font-medium text-text-primary" : "text-text-primary"}>{value}</span>
    </div>
  );
}

export interface InitialRecipient {
  userId: string;
  namintoId: string;
  legalName: string;
}

export function SendMoneyWizard({
  linkedAccounts,
  initialRecipient,
}: {
  linkedAccounts: LinkedAccountOption[];
  initialRecipient?: InitialRecipient | null;
}) {
  const { t, locale } = useLocale();

  // Bénéficiaire prérempli (QR Engine, Prompt 15) : saute directement à
  // l'étape Montant, déjà vérifié côté serveur avant le rendu de cette
  // page — jamais un scan qui exécute quoi que ce soit, seulement un
  // pré-remplissage, la confirmation explicite reste entière plus loin.
  const [step, setStep] = useState<Step>(initialRecipient ? "amount" : "recipientType");
  const [mode, setMode] = useState<RecipientMode | null>(initialRecipient ? "internal" : null);
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);

  const [namintoId, setNamintoId] = useState(initialRecipient?.namintoId ?? "");
  const [lookupPending, startLookup] = useTransition();
  const [lookupResult, setLookupResult] = useState<RecipientLookupResult | null>(
    initialRecipient
      ? { found: true, recipientUserId: initialRecipient.userId, namintoId: initialRecipient.namintoId, legalName: initialRecipient.legalName }
      : null
  );
  const [externalReference, setExternalReference] = useState("");

  const [amountInput, setAmountInput] = useState("");
  const [feePayer, setFeePayer] = useState<FeePayer>("sender");
  const [feePreview, setFeePreview] = useState<FeePreviewResult | null>(null);
  const [previewPending, startPreview] = useTransition();

  const [pin, setPin] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const [submitPending, startSubmit] = useTransition();
  const [result, setResult] = useState<SendMoneyResult | null>(null);

  const amount = Number(amountInput.replace(",", "."));
  const selectedLinkedAccount = linkedAccounts.find((a) => a.id === linkedAccountId) ?? null;

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }

  function runLookup() {
    if (!namintoId.trim()) return;
    startLookup(async () => {
      setLookupResult(await lookupRecipientAction(namintoId));
    });
  }

  function runFeePreview(nextAmount: number, nextFeePayer: FeePayer) {
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setFeePreview(null);
      return;
    }
    startPreview(async () => {
      setFeePreview(
        await previewFeeAction({
          amount: nextAmount,
          sourceType: mode === "internal" ? "naminto_wallet" : "linked_account",
          destinationType: mode === "internal" ? "naminto_wallet" : "external",
          provider: mode === "external" ? (selectedLinkedAccount?.provider ?? null) : null,
          feePayer: nextFeePayer,
        })
      );
    });
  }

  function goToRecap() {
    setIdempotencyKey((current) => current ?? crypto.randomUUID());
    setStep("recap");
  }

  function submit() {
    if (!idempotencyKey || !feePreview?.ok) return;
    startSubmit(async () => {
      const recipient =
        mode === "internal"
          ? { mode: "internal" as const, recipientUserId: lookupResult!.recipientUserId! }
          : {
              mode: "external" as const,
              sourceLinkedAccountId: linkedAccountId!,
              destinationReference: externalReference.trim(),
            };
      const res = await sendMoneyAction({ idempotencyKey, amount, feePayer, pin, recipient });
      setResult(res);
      setStep("result");
    });
  }

  function resetAll() {
    setStep("recipientType");
    setMode(null);
    setLinkedAccountId(null);
    setNamintoId("");
    setLookupResult(null);
    setExternalReference("");
    setAmountInput("");
    setFeePayer("sender");
    setFeePreview(null);
    setPin("");
    setIdempotencyKey(null);
    setResult(null);
  }

  const canContinueRecipientType = mode === "internal" || (mode === "external" && Boolean(linkedAccountId));
  const canContinueRecipientDetails =
    mode === "internal" ? Boolean(lookupResult?.found) : externalReference.trim().length >= 6;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("send.title")}</h1>

      {step === "recipientType" && (
        <StepShell title={t("send.step.recipientType.title")} backLabel={t("send.nav.back")}>
          <div className="flex flex-col gap-3">
            <ChoiceCard
              selected={mode === "internal"}
              onSelect={() => {
                setMode("internal");
                setLinkedAccountId(null);
              }}
              icon={<Wallet className="size-5" aria-hidden />}
              title={t("send.recipientType.internal.title")}
              body={t("send.recipientType.internal.body")}
            />
            <ChoiceCard
              selected={mode === "external"}
              onSelect={() => setMode("external")}
              icon={<Smartphone className="size-5" aria-hidden />}
              title={t("send.recipientType.external.title")}
              body={t("send.recipientType.external.body")}
            />
          </div>

          {mode === "external" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-primary">{t("send.linkedAccount.chooseLabel")}</p>
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
                  {linkedAccounts.map((account) => {
                    const config = getProviderConfig(account.provider);
                    return (
                      <ChoiceCard
                        key={account.id}
                        selected={linkedAccountId === account.id}
                        onSelect={() => setLinkedAccountId(account.id)}
                        icon={<span className={`block size-3 rounded-full ${config.dotClassName}`} />}
                        title={t(config.labelKey)}
                        body={maskExternalReference(account.externalReference)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Button disabled={!canContinueRecipientType} onClick={() => setStep("recipientDetails")}>
            {t("send.nav.next")}
          </Button>
        </StepShell>
      )}

      {step === "recipientDetails" && (
        <StepShell title={t("send.step.recipientDetails.title")} onBack={goBack} backLabel={t("send.nav.back")}>
          {mode === "internal" ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <Input
                  label={t("send.namintoId.label")}
                  placeholder={t("send.namintoId.placeholder")}
                  value={namintoId}
                  onChange={(e) => {
                    setNamintoId(e.target.value);
                    setLookupResult(null);
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  loading={lookupPending}
                  onClick={runLookup}
                  disabled={!namintoId.trim()}
                >
                  {t("send.namintoId.lookup.button")}
                </Button>
              </div>
              {lookupResult?.found && (
                <Alert variant="success">
                  {t("send.namintoId.lookup.found")} {lookupResult.legalName}
                </Alert>
              )}
              {lookupResult && !lookupResult.found && (
                <Alert variant="danger">{t("send.namintoId.lookup.notFound")}</Alert>
              )}
              <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                <QrCode className="size-3.5" aria-hidden />
                {t("send.qr.comingSoon")}
              </p>
            </div>
          ) : (
            <Input
              label={t("send.externalReference.label")}
              placeholder={t("send.externalReference.placeholder")}
              helperText={t("send.externalReference.helper")}
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
              autoComplete="off"
            />
          )}

          <Button disabled={!canContinueRecipientDetails} onClick={() => setStep("amount")}>
            {t("send.nav.next")}
          </Button>
        </StepShell>
      )}

      {step === "amount" && (
        <StepShell title={t("send.step.amount.title")} onBack={goBack} backLabel={t("send.nav.back")}>
          <Input
            label={t("send.amount.label")}
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => {
              const next = e.target.value;
              setAmountInput(next);
              runFeePreview(Number(next.replace(",", ".")), feePayer);
            }}
            errorText={amountInput && !(amount > 0) ? t("send.amount.error.invalid") : undefined}
          />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-text-primary">{t("send.feePayer.label")}</p>
            <div className="flex gap-2">
              {(["sender", "recipient"] as FeePayer[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setFeePayer(option);
                    runFeePreview(amount, option);
                  }}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    feePayer === option
                      ? "border-brand bg-brand/5 text-text-primary ring-1 ring-brand"
                      : "border-border-default text-text-secondary hover:bg-surface-sunken"
                  }`}
                >
                  {t(option === "sender" ? "send.feePayer.sender" : "send.feePayer.recipient")}
                </button>
              ))}
            </div>
          </div>

          {previewPending && <Spinner label={t("send.executing")} />}
          {!previewPending && feePreview?.ok && (
            <div className="flex flex-col gap-1 rounded-md bg-surface-sunken p-3 text-sm">
              <SummaryRow label={t("send.fee.preview.fee")} value={`${feePreview.fee.toLocaleString(locale)} XOF`} />
              <SummaryRow
                label={t("send.fee.preview.senderDebit")}
                value={`${feePreview.senderDebit.toLocaleString(locale)} XOF`}
                strong
              />
              <SummaryRow
                label={t("send.fee.preview.recipientCredit")}
                value={`${feePreview.recipientCredit.toLocaleString(locale)} XOF`}
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

      {step === "recap" && feePreview?.ok && (
        <StepShell title={t("send.step.recap.title")} onBack={goBack} backLabel={t("send.nav.back")}>
          <div className="flex flex-col gap-1 text-sm">
            <SummaryRow
              label={t("send.recap.beneficiary")}
              value={mode === "internal" ? (lookupResult?.legalName ?? "") : externalReference}
            />
            <SummaryRow
              label={t("send.recap.network")}
              value={
                mode === "internal"
                  ? t("send.recap.network.internal")
                  : t(getProviderConfig(selectedLinkedAccount!.provider).labelKey)
              }
            />
            <SummaryRow label={t("send.recap.amount")} value={`${amount.toLocaleString(locale)} XOF`} />
            <SummaryRow label={t("send.recap.fee")} value={`${feePreview.fee.toLocaleString(locale)} XOF`} />
            <SummaryRow
              label={t("send.recap.feePayer")}
              value={t(feePayer === "sender" ? "send.feePayer.sender" : "send.feePayer.recipient")}
            />
            <SummaryRow
              label={t("send.recap.total")}
              value={`${feePreview.senderDebit.toLocaleString(locale)} XOF`}
              strong
            />
            <SummaryRow
              label={t("send.recap.received")}
              value={`${feePreview.recipientCredit.toLocaleString(locale)} XOF`}
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
