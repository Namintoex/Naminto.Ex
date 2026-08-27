"use client";

import { Card, CardContent, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminRoleAssignmentRow } from "@/domains/rbac";
import { AssignRoleForm } from "./assign-role-form";
import { RevokeRoleButton } from "./revoke-role-button";

export function RolesView({ assignments }: { assignments: AdminRoleAssignmentRow[] }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.roles")}</h1>

      <AssignRoleForm />

      {assignments.length === 0 ? (
        <EmptyState title={t("admin.roles.empty")} />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.roles.column.namintoId")}</TableHead>
                  <TableHead>{t("admin.roles.column.roles")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.userId}>
                    <TableCell className="font-medium text-text-primary">{a.namintoId}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {a.roles.map((role) => (
                          <RevokeRoleButton key={role} userId={a.userId} role={role} />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
