"use client";

import { MailCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";

export function CheckEmailCard({ email }: { email?: string }) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <MailCheck className="mb-2 size-8 text-brand" aria-hidden />
        <CardTitle>{t("register.checkEmail.title")}</CardTitle>
      </CardHeader>
      <CardContent className="text-center text-sm text-text-secondary">
        <p>{t("register.checkEmail.body")}</p>
        {email && <p className="mt-2 font-medium text-text-primary">{email}</p>}
      </CardContent>
    </Card>
  );
}
