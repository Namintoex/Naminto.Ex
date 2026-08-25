"use client";

import { useActionState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { updatePasswordAction, type ActionResult } from "@/domains/identity/actions";

export function ConfirmResetForm() {
  const { t } = useLocale();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updatePasswordAction,
    null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resetPassword.confirm.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-1">
        {state && "error" in state && <Alert variant="danger">{t(state.error)}</Alert>}
        <form action={formAction} className="flex flex-col gap-4">
          <Input
            type="password"
            name="password"
            label={t("auth.password")}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            type="password"
            name="passwordConfirm"
            label={t("auth.passwordConfirm")}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Button type="submit" loading={pending}>
            {t("resetPassword.confirm.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
