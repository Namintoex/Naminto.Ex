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
import { adminCreateLimitRuleAction, adminSetLimitRuleActiveAction } from "@/domains/payments/limit-engine/admin-actions";
import type { Database, LimitType } from "@/lib/supabase/database.types";
import { ActiveToggle } from "../../active-toggle";

type LimitRuleRow = Database["public"]["Tables"]["limit_rules"]["Row"];

const LIMIT_TYPES: LimitType[] = ["per_transaction_amount", "daily_amount", "monthly_amount", "frequency_count"];

export function LimitRulesPanel({ rules }: { rules: LimitRuleRow[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [limitType, setLimitType] = useState<LimitType>("per_transaction_amount");
  const [maxAmount, setMaxAmount] = useState("");
  const [maxCount, setMaxCount] = useState("");
  const [periodHours, setPeriodHours] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCountType = limitType === "frequency_count";

  function submit() {
    if (isCountType ? !maxCount : !maxAmount) {
      setError("form.error.required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adminCreateLimitRuleAction({
        limit_type: limitType,
        max_amount: isCountType ? null : Number(maxAmount),
        max_count: isCountType ? Number(maxCount) : null,
        period_hours: periodHours ? Number(periodHours) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMaxAmount("");
      setMaxCount("");
      setPeriodHours("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.pricing.limits.new")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Select
              label="Limit type"
              value={limitType}
              onChange={(e) => setLimitType(e.target.value as LimitType)}
              options={LIMIT_TYPES.map((type) => ({ value: type, label: type }))}
            />
            {isCountType ? (
              <Input label="Max count" inputMode="numeric" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} />
            ) : (
              <Input label="Max amount" inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            )}
            <Input
              label="Period (hours)"
              inputMode="numeric"
              value={periodHours}
              onChange={(e) => setPeriodHours(e.target.value)}
            />
          </div>
          <Button size="sm" loading={pending} onClick={submit} className="self-start">
            {t("admin.pricing.action.create")}
          </Button>
        </CardContent>
      </Card>

      {rules.length === 0 ? (
        <EmptyState title={t("admin.pricing.limits.empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Max</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>{t("admin.pricing.column.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.limit_type}</TableCell>
                <TableCell>{rule.max_amount ?? rule.max_count ?? "—"}</TableCell>
                <TableCell>{rule.period_hours ? `${rule.period_hours}h` : "—"}</TableCell>
                <TableCell>
                  <ActiveToggle active={rule.active} onToggle={(next) => adminSetLimitRuleActiveAction(rule.id, next)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
