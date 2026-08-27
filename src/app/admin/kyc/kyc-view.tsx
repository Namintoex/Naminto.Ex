"use client";

import Link from "next/link";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminListUsersResult } from "@/domains/identity/admin-queries";
import type { KycStatus } from "@/lib/supabase/database.types";
import { AdminPagination } from "../admin-pagination";
import { KycActionButtons } from "./kyc-action-buttons";

const STATUSES: KycStatus[] = ["pending", "requires_action", "unverified", "verified", "rejected"];

function kycVariant(status: KycStatus) {
  if (status === "verified") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "pending" || status === "requires_action") return "warning" as const;
  return "neutral" as const;
}

export function KycView({ result, status }: { result: AdminListUsersResult; status: KycStatus | "all" }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.kyc")}</h1>

      <Card>
        <CardContent className="pt-5">
          <form action="/admin/kyc" method="GET" className="max-w-xs">
            <Select
              name="status"
              defaultValue={status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              options={[
                { value: "all", label: t("admin.kyc.filter.all") },
                ...STATUSES.map((s) => ({ value: s, label: t(`settings.kyc.${s}`) })),
              ]}
            />
          </form>
        </CardContent>
      </Card>

      {result.users.length === 0 ? (
        <EmptyState title={t("admin.users.empty")} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.users.column.namintoId")}</TableHead>
                <TableHead>{t("admin.users.column.legalName")}</TableHead>
                <TableHead>{t("admin.users.column.kyc")}</TableHead>
                <TableHead>{t("table.column.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <Link href={`/admin/users/${user.user_id}`} className="font-medium text-brand hover:underline">
                      {user.naminto_id}
                    </Link>
                  </TableCell>
                  <TableCell>{user.legal_name}</TableCell>
                  <TableCell>
                    <Badge variant={kycVariant(user.kyc_status)}>{t(`settings.kyc.${user.kyc_status}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    <KycActionButtons userId={user.user_id} current={user.kyc_status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminPagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(p) => `/admin/kyc?status=${status}&page=${p}`}
          />
        </>
      )}
    </div>
  );
}
