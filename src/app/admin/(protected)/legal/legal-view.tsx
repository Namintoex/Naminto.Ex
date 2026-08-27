"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import {
  adminCreateLegalDocumentAction,
  adminSetLegalDocumentPublishedAction,
} from "@/domains/legal/admin-actions";
import type { LegalDocumentRow } from "@/domains/legal/queries";
import type { LegalDocumentType, Locale } from "@/lib/supabase/database.types";

const TYPES: LegalDocumentType[] = ["terms", "privacy", "pricing_disclosure", "other"];

function PublishButton({ id, published }: { id: string; published: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await adminSetLegalDocumentPublishedAction(id, !published);
          router.refresh();
        })
      }
    >
      {t(published ? "admin.legal.action.unpublish" : "admin.legal.action.publish")}
    </Button>
  );
}

export function LegalView({ documents }: { documents: LegalDocumentRow[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [type, setType] = useState<LegalDocumentType>("terms");
  const [docLocale, setDocLocale] = useState<Locale>("fr");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState("1.0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await adminCreateLegalDocumentAction({ type, locale: docLocale, title, content, version });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setContent("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.legal")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.legal.new")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <Alert variant="danger">{t(error)}</Alert>}
          <div className="grid grid-cols-3 gap-3">
            <Select
              label={t("admin.legal.column.type")}
              value={type}
              onChange={(e) => setType(e.target.value as LegalDocumentType)}
              options={TYPES.map((docType) => ({ value: docType, label: t(`admin.legal.type.${docType}`) }))}
            />
            <Select
              label={t("admin.faq.column.locale")}
              value={docLocale}
              onChange={(e) => setDocLocale(e.target.value as Locale)}
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
              ]}
            />
            <Input label={t("admin.legal.field.version")} value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <Input label={t("admin.legal.field.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label={t("admin.legal.field.content")} value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
          <Button size="sm" loading={pending} onClick={submit} className="self-start">
            {t("admin.pricing.action.create")}
          </Button>
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <EmptyState title={t("admin.legal.empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.legal.column.title")}</TableHead>
              <TableHead>{t("admin.legal.column.type")}</TableHead>
              <TableHead>{t("admin.legal.column.version")}</TableHead>
              <TableHead>{t("admin.legal.column.published")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="max-w-48 truncate">{doc.title}</TableCell>
                <TableCell>{t(`admin.legal.type.${doc.type}`)}</TableCell>
                <TableCell>{doc.version}</TableCell>
                <TableCell>
                  <Badge variant={doc.published ? "success" : "neutral"}>
                    {doc.published ? t("badge.active") : t("badge.pending")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <PublishButton id={doc.id} published={doc.published} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
