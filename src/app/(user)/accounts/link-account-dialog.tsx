"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalClose,
  ModalContent,
  ModalTrigger,
  Select,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { linkAccountAction, type ActionResult } from "@/domains/accounts/actions";
import { PROVIDERS } from "@/domains/accounts/providers";

/** `trigger` : élément déclencheur personnalisé (ex. bouton "+" du tableau de bord) — le bouton texte par défaut reste utilisé sur `/accounts`. */
export function LinkAccountDialog({ trigger }: { trigger?: ReactNode } = {}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await linkAccountAction(prev, formData);
      if ("success" in result) {
        setOpen(false);
      }
      return result;
    },
    null
  );

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>{trigger ?? <Button>{t("accounts.link.button")}</Button>}</ModalTrigger>
      <ModalContent title={t("accounts.link.title")}>
        <div className="flex flex-col gap-4">
          <Alert variant="info" title={t("accounts.link.disclaimer.title")}>
            {t("accounts.link.disclaimer.body")}
          </Alert>

          {state && "error" in state && <Alert variant="danger">{t(state.error)}</Alert>}

          <form action={formAction} className="flex flex-col gap-4">
            <Select
              name="provider"
              label={t("accounts.link.provider")}
              options={PROVIDERS.map((p) => ({ value: p.id, label: t(p.labelKey) }))}
              required
            />
            <Input
              name="externalReference"
              label={t("accounts.link.reference")}
              helperText={t("accounts.link.reference.helper")}
              required
              autoComplete="off"
            />

            <div className="flex flex-col gap-1.5 rounded-md bg-surface-sunken p-3 text-xs text-text-secondary">
              <p className="flex gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("accounts.link.consent.canView")}
              </p>
              <p className="flex gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("accounts.link.consent.canDo")}
              </p>
              <p className="flex gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("accounts.link.consent.cannotDo")}
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-0.5 size-4 rounded border-border-default"
              />
              {t("accounts.link.consent.checkbox")}
            </label>

            <div className="flex justify-end gap-2">
              <ModalClose asChild>
                <Button type="button" variant="secondary" size="sm">
                  {t("accounts.link.cancel")}
                </Button>
              </ModalClose>
              <Button type="submit" size="sm" loading={pending}>
                {t("accounts.link.submit")}
              </Button>
            </div>
          </form>
        </div>
      </ModalContent>
    </Modal>
  );
}
