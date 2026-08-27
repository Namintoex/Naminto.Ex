"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminUserDetail } from "@/domains/identity/admin-queries";
import type { KycStatus } from "@/lib/supabase/database.types";
import { SuspendUserButton } from "./suspend-user-button";

function kycVariant(status: KycStatus) {
  if (status === "verified") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "pending" || status === "requires_action") return "warning" as const;
  return "neutral" as const;
}

export function UserDetailView({ detail, canSuspend }: { detail: AdminUserDetail; canSuspend: boolean }) {
  const { t, locale } = useLocale();
  const { profile, email, devices, securityEvents } = detail;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/admin/users" className="flex items-center gap-1.5 text-sm text-text-secondary hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("admin.users.detail.back")}
      </Link>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{profile.legal_name}</CardTitle>
          <Badge variant={kycVariant(profile.kyc_status)}>{t(`settings.kyc.${profile.kyc_status}`)}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("auth.namintoId")}</span>
            <span className="font-medium text-text-primary">{profile.naminto_id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("admin.users.detail.email")}</span>
            <span className="font-medium text-text-primary">{email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("admin.users.column.phone")}</span>
            <span className="font-medium text-text-primary">{profile.phone_number ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t("admin.users.column.status")}</span>
            <Badge variant={profile.status === "suspended" ? "danger" : "success"}>{profile.status}</Badge>
          </div>
          {canSuspend && (
            <div className="pt-2">
              <SuspendUserButton userId={profile.user_id} status={profile.status} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.users.detail.devices")}</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <EmptyState title={t("security.devices.empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{device.platform ?? "—"}</span>
                  <Badge variant={device.status === "active" ? "success" : "neutral"}>{device.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.users.detail.events")}</CardTitle>
        </CardHeader>
        <CardContent>
          {securityEvents.length === 0 ? (
            <EmptyState title={t("security.history.empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {securityEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-text-primary">{t(`security.event.${event.type}`)}</span>
                  <span className="text-text-secondary">{new Date(event.created_at).toLocaleString(locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
