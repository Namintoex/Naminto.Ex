"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { requestPasswordResetAction, type ActionResult } from "@/domains/identity/actions";

export function ResetPasswordForm() {
  const { t } = useLocale();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    requestPasswordResetAction,
    null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resetPassword.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-1">
        {state && "success" in state && (
          <Alert variant="success">{t("resetPassword.sent")}</Alert>
        )}
        {state && "error" in state && <Alert variant="danger">{t(state.error)}</Alert>}
        <form action={formAction} className="flex flex-col gap-4">
          <Input type="email" name="email" label={t("auth.email")} required autoComplete="email" />
          <Button type="submit" loading={pending}>
            {t("resetPassword.submit")}
          </Button>
        </form>
        <Link href="/login" className="text-sm text-brand hover:text-brand-hover">
          {t("register.signIn")}
        </Link>
      </CardContent>
    </Card>
  );
}
