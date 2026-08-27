"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bot, Send, User } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { sendAssistMessageAction } from "@/domains/assist/actions";
import type { AssistResponse } from "@/domains/assist/types";
import { TicketDialog } from "./ticket-dialog";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; response: AssistResponse }
  | { id: string; role: "assistant"; errorKey: string }
  | { id: string; role: "assistant"; ticketCreated: true };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function AssistAnswer({
  response,
  onOfferTicket,
}: {
  response: AssistResponse;
  onOfferTicket: (reference?: string) => void;
}) {
  const { t, locale } = useLocale();

  const body = (() => {
    switch (response.intent) {
      case "menu":
      case "unknown":
        return <p>{t(response.intent === "menu" ? "assist.menu.text" : "assist.unknown.text")}</p>;

      case "sensitive_request":
        return (
          <p>
            {t(response.sensitiveReason === "secret" ? "assist.sensitive.secret.text" : "assist.sensitive.transfer.text")}
          </p>
        );

      case "explain_fees":
        if (response.fee === undefined) {
          return <p>{t("assist.fees.noAmount.text")}</p>;
        }
        if (response.fee === null) {
          return <p>{t("assist.fees.noRule.text")}</p>;
        }
        return (
          <p>
            {t("assist.fees.result.prefix")}{" "}
            <strong>
              {response.fee.amount.toLocaleString(locale)} {response.fee.currency}
            </strong>
            {t("assist.fees.result.suffix")}{" "}
            <strong>
              {response.fee.fee.toLocaleString(locale)} {response.fee.currency}
            </strong>
            .
          </p>
        );

      case "explain_status":
        return <p>{t(response.status ? `assist.status.${response.status}.text` : "assist.status.generic.text")}</p>;

      case "diagnose_transaction":
        if (!response.diagnosis) {
          return <p>{t("assist.diagnose.notFound.text")}</p>;
        }
        return (
          <div className="flex flex-col gap-1">
            <p>
              {t("assist.diagnose.found.prefix")} <strong>{response.diagnosis.reference}</strong>{" "}
              {t("assist.diagnose.found.middle")}{" "}
              <Badge variant="neutral">{t(`transaction.status.${response.diagnosis.status}`)}</Badge>
            </p>
            <p>{t(`assist.status.${response.diagnosis.status}.text`)}</p>
            {response.diagnosis.reasonCode && (
              <p>
                {t("assist.diagnose.reason.prefix")}{" "}
                {t(`send.error.${reasonCodeToKeySuffix(response.diagnosis.reasonCode)}`)}
              </p>
            )}
          </div>
        );

      case "search_transaction":
        if (!response.recentTransactions || response.recentTransactions.length === 0) {
          return <p>{t("assist.search.empty.text")}</p>;
        }
        return (
          <div className="flex flex-col gap-1.5">
            <p>{t("assist.search.intro.text")}</p>
            <ul className="flex flex-col gap-1">
              {response.recentTransactions.map((tx) => (
                <li key={tx.reference} className="flex items-center justify-between text-sm">
                  <Link href={`/history/${tx.reference}`} className="font-medium text-brand hover:underline">
                    {tx.reference}
                  </Link>
                  <span className="text-text-secondary">
                    {tx.amount.toLocaleString(locale)} {tx.currency}
                  </span>
                  <Badge variant="neutral">{t(`transaction.status.${tx.status}`)}</Badge>
                </li>
              ))}
            </ul>
          </div>
        );

      case "guide":
        return <p>{t(`assist.guide.${response.topic ?? "send"}.text`)}</p>;

      case "create_ticket":
        return <p>{t("assist.ticket.offer.text")}</p>;

      default:
        return null;
    }
  })();

  const reference = response.intent === "diagnose_transaction" ? response.diagnosis?.reference : undefined;

  return (
    <div className="flex flex-col gap-2">
      {body}
      {response.suggestedActions && response.suggestedActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {response.suggestedActions.map((action) => (
            <Button key={action.href} asChild variant="secondary" size="sm">
              <Link href={action.href}>{t(action.labelKey)}</Link>
            </Button>
          ))}
        </div>
      )}
      {response.offerTicket && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => onOfferTicket(reference)}>
            {t("assist.ticket.button")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** send.error.* n'a pas de clé "auth" pertinente ici (jamais le code renvoyé par l'orchestrateur pour un échec de transaction) — repli sur "system" pour tout code non mappé. */
function reasonCodeToKeySuffix(code: string): string {
  const known: Record<string, string> = {
    VALIDATION_ERROR: "validation",
    RISK_REJECTION: "risk",
    FRAUD_BLOCKED: "fraud",
    MANUAL_REVIEW_REQUIRED: "manualReview",
    COMPLIANCE_REJECTION: "compliance",
    LIMIT_ERROR: "limit",
    PROVIDER_ERROR: "provider",
    TIMEOUT: "timeout",
    SYSTEM_ERROR: "system",
  };
  return known[code] ?? "system";
}

export function AssistView() {
  const { t } = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [ticketDialog, setTicketDialog] = useState<{ open: boolean; reference?: string }>({ open: false });

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setMessages((prev) => [...prev, { id: newId(), role: "user", text }]);

    startTransition(async () => {
      const result = await sendAssistMessageAction(text);
      setMessages((prev) => [
        ...prev,
        result.ok
          ? { id: newId(), role: "assistant", response: result.response }
          : { id: newId(), role: "assistant", errorKey: result.errorKey },
      ]);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.assist")}</h1>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex items-start gap-2.5">
            <Bot className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <p className="text-sm text-text-secondary">{t("assist.intro")}</p>
          </div>

          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex items-start justify-end gap-2.5">
                  <p className="rounded-lg bg-brand px-3 py-2 text-sm text-brand-foreground">{message.text}</p>
                  <User className="mt-0.5 size-5 shrink-0 text-text-secondary" aria-hidden />
                </div>
              );
            }
            return (
              <div key={message.id} className="flex items-start gap-2.5">
                <Bot className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                <div className="flex-1 text-sm text-text-primary">
                  {"ticketCreated" in message ? (
                    <p>{t("assist.ticket.created.text")}</p>
                  ) : "errorKey" in message ? (
                    <Alert variant="danger">{t(message.errorKey)}</Alert>
                  ) : (
                    <AssistAnswer
                      response={message.response}
                      onOfferTicket={(reference) => setTicketDialog({ open: true, reference })}
                    />
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t("assist.placeholder")}
              disabled={pending}
              className="flex-1"
            />
            <Button onClick={send} loading={pending} aria-label={t("assist.send")}>
              <Send className="size-4" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>

      <TicketDialog
        open={ticketDialog.open}
        onOpenChange={(open) => setTicketDialog((prev) => ({ ...prev, open }))}
        defaultReference={ticketDialog.reference}
        onCreated={() => setMessages((prev) => [...prev, { id: newId(), role: "assistant", ticketCreated: true }])}
      />
    </div>
  );
}
