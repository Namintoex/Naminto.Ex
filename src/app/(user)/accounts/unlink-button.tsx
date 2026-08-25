"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, ModalClose, ModalContent, ModalTrigger } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { unlinkAccountAction } from "@/domains/accounts/actions";

export function UnlinkButton({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Modal>
      <ModalTrigger asChild>
        <Button variant="secondary" size="sm">
          {t("accounts.unlink.button")}
        </Button>
      </ModalTrigger>
      <ModalContent title={t("accounts.unlink.confirm.title")} description={t("accounts.unlink.confirm.body")}>
        <div className="flex justify-end gap-2">
          <ModalClose asChild>
            <Button variant="secondary" size="sm">
              {t("accounts.link.cancel")}
            </Button>
          </ModalClose>
          <ModalClose asChild>
            <Button
              variant="destructive"
              size="sm"
              loading={pending}
              onClick={() => {
                startTransition(async () => {
                  await unlinkAccountAction(accountId);
                  router.refresh();
                });
              }}
            >
              {t("accounts.unlink.confirm.action")}
            </Button>
          </ModalClose>
        </div>
      </ModalContent>
    </Modal>
  );
}
