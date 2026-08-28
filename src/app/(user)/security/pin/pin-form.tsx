"use client";

import { useActionState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { createPinAction, type ActionResult } from "@/domains/identity/actions";

export function PinForm({ welcome }: { welcome: boolean }) {
  const { t } = useLocale();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createPinAction,
    null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{welcome ? t("pin.create.title") : t("pin.change.title")}</CardTitle>
        {welcome && <p className="text-sm text-text-secondary">{t("pin.create.body")}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-1">
        {state && "error" in state && <Alert variant="danger">{t(state.error)}</Alert>}
        <form action={formAction} className="flex flex-col gap-4">
          {!welcome && (
            <Input
              type="password"
              inputMode="numeric"
              name="currentPin"
              label={t("pin.labelCurrent")}
              required
              pattern="\d{6}"
              maxLength={6}
              autoComplete="off"
            />
          )}
          <Input
            type="password"
            inputMode="numeric"
            name="pin"
            label={t("pin.label")}
            required
            pattern="\d{6}"
            maxLength={6}
            autoComplete="off"
          />
          <Input
            type="password"
            inputMode="numeric"
            name="pinConfirm"
            label={t("pin.labelConfirm")}
            required
            pattern="\d{6}"
            maxLength={6}
            autoComplete="off"
          />
          <Button type="submit" loading={pending}>
            {t("pin.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
