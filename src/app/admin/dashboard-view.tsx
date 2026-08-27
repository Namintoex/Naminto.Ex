"use client";

import { Users, BadgeCheck, LifeBuoy, ArrowLeftRight, CircleCheck, CircleX, Coins } from "lucide-react";
import { Card, CardContent } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { AdminDashboardStats } from "@/domains/payments/history";

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-brand">
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-text-primary">{value}</span>
          <span className="text-xs text-text-secondary">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView({
  stats,
  pendingKycCount,
  openTicketsCount,
  totalUsersCount,
}: {
  stats: AdminDashboardStats;
  pendingKycCount: number;
  openTicketsCount: number;
  totalUsersCount: number;
}) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.dashboard")}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          icon={<Users className="size-4" aria-hidden />}
          label={t("admin.dashboard.totalUsers")}
          value={totalUsersCount.toLocaleString(locale)}
        />
        <StatTile
          icon={<ArrowLeftRight className="size-4" aria-hidden />}
          label={t("admin.dashboard.transactionsToday")}
          value={stats.transactionsToday.toLocaleString(locale)}
        />
        <StatTile
          icon={<CircleCheck className="size-4" aria-hidden />}
          label={t("admin.dashboard.settledCountToday")}
          value={stats.settledCountToday.toLocaleString(locale)}
        />
        <StatTile
          icon={<CircleX className="size-4" aria-hidden />}
          label={t("admin.dashboard.failedCountToday")}
          value={stats.failedCountToday.toLocaleString(locale)}
        />
        <StatTile
          icon={<Coins className="size-4" aria-hidden />}
          label={t("admin.dashboard.settledVolumeToday")}
          value={`${stats.settledVolumeToday.toLocaleString(locale)} XOF`}
        />
        <StatTile
          icon={<BadgeCheck className="size-4" aria-hidden />}
          label={t("admin.dashboard.pendingKyc")}
          value={pendingKycCount.toLocaleString(locale)}
        />
        <StatTile
          icon={<LifeBuoy className="size-4" aria-hidden />}
          label={t("admin.dashboard.openTickets")}
          value={openTicketsCount.toLocaleString(locale)}
        />
      </div>
    </div>
  );
}
