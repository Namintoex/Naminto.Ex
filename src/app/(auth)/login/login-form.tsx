"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { loginAction, type ActionResult } from "@/domains/identity/actions";

export function LoginForm() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("login.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-1">
        {state && "error" in state && (
          <Alert variant="danger">{t(state.error)}</Alert>
        )}
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Input type="email" name="email" label={t("auth.email")} required autoComplete="email" />
          <Input
            type="password"
            name="password"
            label={t("auth.password")}
            required
            autoComplete="current-password"
          />
          <Button type="submit" loading={pending} className="mt-1">
            {t("login.submit")}
          </Button>
        </form>
        <div className="flex flex-col gap-1 text-sm">
          <Link href="/reset-password" className="text-brand hover:text-brand-hover">
            {t("login.forgotPassword")}
          </Link>
          <p className="text-text-secondary">
            {t("login.noAccount")}{" "}
            <Link href="/register" className="text-brand hover:text-brand-hover">
              {t("login.createAccount")}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
