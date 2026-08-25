"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { registerAction, type ActionResult } from "@/domains/identity/actions";

export function RegisterForm() {
  const { t } = useLocale();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    registerAction,
    null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("register.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-1">
        {state && "error" in state && <Alert variant="danger">{t(state.error)}</Alert>}
        <form action={formAction} className="flex flex-col gap-4">
          <Input name="legalName" label={t("auth.legalName")} required autoComplete="name" />
          <Input
            name="namintoId"
            label={t("auth.namintoId")}
            helperText={t("auth.namintoId.helper")}
            required
            pattern="[a-z0-9_]{3,20}"
            autoComplete="username"
          />
          <Input
            type="tel"
            name="phoneNumber"
            label={t("auth.phoneNumber")}
            helperText={t("auth.phoneNumber.helper")}
            autoComplete="tel"
          />
          <Input type="email" name="email" label={t("auth.email")} required autoComplete="email" />
          <Input
            type="password"
            name="password"
            label={t("auth.password")}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Button type="submit" loading={pending} className="mt-1">
            {t("register.submit")}
          </Button>
        </form>
        <p className="text-sm text-text-secondary">
          {t("register.hasAccount")}{" "}
          <Link href="/login" className="text-brand hover:text-brand-hover">
            {t("register.signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
