"use client";

import { useLocale } from "../i18n/locale-provider";
import { Button } from "./button";

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
      aria-label="Changer de langue"
    >
      {locale === "fr" ? "FR" : "EN"}
    </Button>
  );
}
