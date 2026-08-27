"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
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
import { AdminPagination } from "../../admin-pagination";

function kycVariant(status: KycStatus) {
  if (status === "verified") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "pending" || status === "requires_action") return "warning" as const;
  return "neutral" as const;
}

export function UsersView({ result, search }: { result: AdminListUsersResult; search: string }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.users")}</h1>

      <Card>
        <CardContent className="pt-5">
          <form action="/admin/users" method="GET" className="flex gap-2">
            <Input name="q" placeholder={t("admin.users.search.placeholder")} defaultValue={search} className="flex-1" />
            <Button type="submit">
              <Search className="size-4" aria-hidden />
            </Button>
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
                <TableHead>{t("admin.users.column.phone")}</TableHead>
                <TableHead>{t("admin.users.column.kyc")}</TableHead>
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
                  <TableCell className="text-text-secondary">{user.phone_number ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={kycVariant(user.kyc_status)}>{t(`settings.kyc.${user.kyc_status}`)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminPagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(p) => `/admin/users?${search ? `q=${encodeURIComponent(search)}&` : ""}page=${p}`}
          />
        </>
      )}
    </div>
  );
}
