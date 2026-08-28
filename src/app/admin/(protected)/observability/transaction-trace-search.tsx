"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card, CardContent, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminTransactionTraceAction } from "@/domains/observability/admin-actions";
import type { TransactionTraceResult } from "@/domains/observability";

export function TransactionTraceSearch() {
  const { t, locale } = useLocale();
  const [reference, setReference] = useState("");
  const [trace, setTrace] = useState<TransactionTraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    setError(null);
    setTrace(null);
    startTransition(async () => {
      const result = await adminTransactionTraceAction(reference);
      if (result.ok) {
        setTrace(result.trace);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label={t("admin.observability.trace.label")}
              placeholder="NEX-XXXXXXXX"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search();
              }}
            />
          </div>
          <Button size="sm" loading={pending} onClick={search} disabled={!reference.trim()}>
            {t("admin.observability.trace.search")}
          </Button>
        </div>

        {error && <Alert variant="danger">{t(error)}</Alert>}

        {trace && (
          <ol className="flex flex-col gap-2 border-l-2 border-border-default pl-4">
            {trace.timeline.map((entry, index) => (
              <li key={index} className="flex flex-col">
                <span className="text-xs text-text-secondary">{new Date(entry.timestamp).toLocaleString(locale)}</span>
                <span className="text-sm font-medium text-text-primary">
                  {entry.source === "status" ? t("admin.observability.trace.status") : t("admin.observability.trace.event")}
                  {" · "}
                  {entry.label}
                </span>
                {entry.detail && <span className="text-xs text-text-secondary">{entry.detail}</span>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
