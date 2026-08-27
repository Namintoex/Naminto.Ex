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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminCreateCountryAction, adminSetCountryActiveAction } from "@/domains/countries/admin-actions";
import type { CountryRow } from "@/domains/countries/queries";
import { ActiveToggle } from "../../active-toggle";

export function CountriesView({ countries }: { countries: CountryRow[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await adminCreateCountryAction({ code, name, currency });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCode("");
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.countries")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.countries.new")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          <div className="grid grid-cols-3 gap-3">
            <Input label={t("admin.countries.column.code")} value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} />
            <Input label={t("admin.countries.column.name")} value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label={t("admin.countries.column.currency")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
          <Button size="sm" loading={pending} onClick={submit} className="self-start">
            {t("admin.pricing.action.create")}
          </Button>
        </CardContent>
      </Card>

      {countries.length === 0 ? (
        <EmptyState title={t("admin.countries.empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.countries.column.code")}</TableHead>
              <TableHead>{t("admin.countries.column.name")}</TableHead>
              <TableHead>{t("admin.countries.column.currency")}</TableHead>
              <TableHead>{t("admin.pricing.column.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {countries.map((country) => (
              <TableRow key={country.id}>
                <TableCell className="font-medium text-text-primary">{country.code}</TableCell>
                <TableCell>{country.name}</TableCell>
                <TableCell>{country.currency}</TableCell>
                <TableCell>
                  <ActiveToggle
                    active={country.active}
                    onToggle={(next) => adminSetCountryActiveAction(country.id, next)}
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
