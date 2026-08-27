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
import {
  adminCreateComplianceRuleAction,
  adminSetComplianceRuleActiveAction,
} from "@/domains/payments/compliance-engine/admin-actions";
import type { ComplianceRequirement, ComplianceRuleType, Database } from "@/lib/supabase/database.types";
import { ActiveToggle } from "../../active-toggle";

type ComplianceRuleRow = Database["public"]["Tables"]["compliance_rules"]["Row"];

const RULE_TYPES: ComplianceRuleType[] = ["PRODUCT_RULE", "REGULATORY_RULE", "CONFIGURATION"];
const REQUIREMENTS: ComplianceRequirement[] = ["NONE", "KYC_STANDARD", "KYC_ENHANCED", "MANUAL_REVIEW"];

export function ComplianceRulesPanel({ rules }: { rules: ComplianceRuleRow[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [ruleType, setRuleType] = useState<ComplianceRuleType>("CONFIGURATION");
  const [requirement, setRequirement] = useState<ComplianceRequirement>("KYC_STANDARD");
  const [currency, setCurrency] = useState("XOF");
  const [minAmount, setMinAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!description.trim()) {
      setError("form.error.required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adminCreateComplianceRuleAction({
        rule_type: ruleType,
        requirement,
        currency: currency.trim() || null,
        min_amount: minAmount ? Number(minAmount) : null,
        description: description.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMinAmount("");
      setDescription("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.pricing.compliance.new")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Select
              label="Rule type"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as ComplianceRuleType)}
              options={RULE_TYPES.map((type) => ({ value: type, label: type }))}
            />
            <Select
              label="Requirement"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value as ComplianceRequirement)}
              options={REQUIREMENTS.map((r) => ({ value: r, label: r }))}
            />
            <Input label={t("admin.pricing.column.currency")} value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <Input label="Min amount" inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          </div>
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button size="sm" loading={pending} onClick={submit} className="self-start">
            {t("admin.pricing.action.create")}
          </Button>
        </CardContent>
      </Card>

      {rules.length === 0 ? (
        <EmptyState title={t("admin.pricing.compliance.empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requirement</TableHead>
              <TableHead>{t("admin.pricing.column.currency")}</TableHead>
              <TableHead>Min amount</TableHead>
              <TableHead>{t("admin.pricing.column.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.requirement}</TableCell>
                <TableCell>{rule.currency ?? "—"}</TableCell>
                <TableCell>{rule.min_amount ?? "—"}</TableCell>
                <TableCell>
                  <ActiveToggle
                    active={rule.active}
                    onToggle={(next) => adminSetComplianceRuleActiveAction(rule.id, next)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
