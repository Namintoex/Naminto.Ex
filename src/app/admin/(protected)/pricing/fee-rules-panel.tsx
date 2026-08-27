"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminCreateFeeRuleAction, adminSetFeeRuleActiveAction } from "@/domains/payments/fee-engine/admin-actions";
import type { Database } from "@/lib/supabase/database.types";
import { ActiveToggle } from "../../active-toggle";

type FeeRuleRow = Database["public"]["Tables"]["fee_rules"]["Row"];

export function FeeRulesPanel({ rules }: { rules: FeeRuleRow[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [currency, setCurrency] = useState("XOF");
  const [ratePercent, setRatePercent] = useState("");
  const [flatFee, setFlatFee] = useState("");
  const [feePayer, setFeePayer] = useState<"sender" | "recipient">("sender");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const rate = Number(ratePercent);
    if (!Number.isFinite(rate) || rate < 0) {
      setError("form.error.required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adminCreateFeeRuleAction({
        currency: currency.trim() || null,
        rate_percent: rate / 100,
        flat_fee: flatFee ? Number(flatFee) : 0,
        fee_payer: feePayer,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRatePercent("");
      setFlatFee("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.pricing.fees.new")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input label={t("admin.pricing.column.currency")} value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <Input
              label={t("admin.pricing.fees.rate")}
              inputMode="decimal"
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
            />
            <Input
              label={t("admin.pricing.fees.flat")}
              inputMode="decimal"
              value={flatFee}
              onChange={(e) => setFlatFee(e.target.value)}
            />
            <Select
              label="Fee payer"
              value={feePayer}
              onChange={(e) => setFeePayer(e.target.value as "sender" | "recipient")}
              options={[
                { value: "sender", label: "Sender" },
                { value: "recipient", label: "Recipient" },
              ]}
            />
          </div>
          <Button size="sm" loading={pending} onClick={submit} className="self-start">
            {t("admin.pricing.action.create")}
          </Button>
        </CardContent>
      </Card>

      {rules.length === 0 ? (
        <EmptyState title={t("admin.pricing.fees.empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.pricing.column.currency")}</TableHead>
              <TableHead>{t("admin.pricing.fees.rate")}</TableHead>
              <TableHead>{t("admin.pricing.fees.flat")}</TableHead>
              <TableHead>{t("admin.pricing.column.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.currency ?? "—"}</TableCell>
                <TableCell>{(rule.rate_percent * 100).toFixed(2)}%</TableCell>
                <TableCell>{rule.flat_fee}</TableCell>
                <TableCell>
                  <ActiveToggle active={rule.active} onToggle={(next) => adminSetFeeRuleActiveAction(rule.id, next)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
