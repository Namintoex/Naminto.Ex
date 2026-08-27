"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Modal, ModalClose, ModalContent, Select, Textarea, Input } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { createTicketAction } from "@/domains/assist/actions";
import type { TicketCategory } from "@/domains/assist/types";

export function TicketDialog({
  open,
  onOpenChange,
  defaultReference,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultReference?: string;
  onCreated: (id: string) => void;
}) {
  const { t } = useLocale();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>(defaultReference ? "transaction_issue" : "other");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTicketAction({
        subject,
        description,
        category,
        relatedTransactionReference: defaultReference,
      });
      if (!result.ok) {
        setError(result.errorKey);
        return;
      }
      setSubject("");
      setDescription("");
      onOpenChange(false);
      onCreated(result.id);
    });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={t("assist.ticket.modal.title")}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          {defaultReference && (
            <p className="text-xs text-text-secondary">
              {t("history.detail.reference")} : {defaultReference}
            </p>
          )}
          <Input
            label={t("assist.ticket.modal.subject.label")}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={140}
            required
          />
          <Textarea
            label={t("assist.ticket.modal.description.label")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            required
          />
          <Select
            label={t("assist.ticket.modal.category.label")}
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            options={[
              { value: "transaction_issue", label: t("assist.ticket.category.transaction_issue") },
              { value: "fees", label: t("assist.ticket.category.fees") },
              { value: "account", label: t("assist.ticket.category.account") },
              { value: "other", label: t("assist.ticket.category.other") },
            ]}
          />
          <div className="flex justify-end gap-2">
            <ModalClose asChild>
              <Button type="button" variant="secondary" size="sm">
                {t("assist.ticket.modal.cancel")}
              </Button>
            </ModalClose>
            <Button size="sm" loading={pending} onClick={submit}>
              {t("assist.ticket.modal.submit")}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
