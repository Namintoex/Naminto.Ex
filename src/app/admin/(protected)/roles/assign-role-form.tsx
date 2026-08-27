"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { adminAssignRoleByNamintoIdAction } from "@/domains/rbac/admin-actions";
import { ADMIN_ROLES, type AdminRole } from "@/domains/rbac/types";

export function AssignRoleForm() {
  const { t } = useLocale();
  const router = useRouter();
  const [namintoId, setNamintoId] = useState("");
  const [role, setRole] = useState<AdminRole>("support");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await adminAssignRoleByNamintoIdAction(namintoId, role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNamintoId("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.roles.assign.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <Alert variant="danger">{t(error)}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("admin.roles.assign.namintoId")}
            value={namintoId}
            onChange={(e) => setNamintoId(e.target.value)}
          />
          <Select
            label={t("admin.roles.assign.role")}
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            options={ADMIN_ROLES.map((r) => ({ value: r, label: t(`admin.roles.role.${r}`) }))}
          />
        </div>
        <Button size="sm" loading={pending} onClick={submit} className="self-start">
          {t("admin.roles.assign.submit")}
        </Button>
      </CardContent>
    </Card>
  );
}
