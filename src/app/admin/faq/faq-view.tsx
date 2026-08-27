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
  Textarea,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminCreateFaqEntryAction, adminSetFaqEntryActiveAction } from "@/domains/faq/admin-actions";
import type { FaqEntryRow } from "@/domains/faq/queries";
import type { Locale } from "@/lib/supabase/database.types";
import { ActiveToggle } from "../active-toggle";

export function FaqView({ entries }: { entries: FaqEntryRow[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("fr");
  const [category, setCategory] = useState("general");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await adminCreateFaqEntryAction({ locale, category, question, answer });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQuestion("");
      setAnswer("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.faq")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.faq.new")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("admin.faq.column.locale")}
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
              ]}
            />
            <Input label={t("admin.faq.field.category")} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <Input label={t("admin.faq.field.question")} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <Textarea label={t("admin.faq.field.answer")} value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} />
          <Button size="sm" loading={pending} onClick={submit} className="self-start">
            {t("admin.pricing.action.create")}
          </Button>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <EmptyState title={t("admin.faq.empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.faq.column.locale")}</TableHead>
              <TableHead>{t("admin.faq.column.question")}</TableHead>
              <TableHead>{t("admin.faq.column.category")}</TableHead>
              <TableHead>{t("admin.pricing.column.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.locale.toUpperCase()}</TableCell>
                <TableCell className="max-w-60 truncate">{entry.question}</TableCell>
                <TableCell>{entry.category}</TableCell>
                <TableCell>
                  <ActiveToggle active={entry.active} onToggle={(next) => adminSetFaqEntryActiveAction(entry.id, next)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
