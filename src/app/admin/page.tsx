import { adminDashboardStats } from "@/domains/payments/history";
import { adminListUsers } from "@/domains/identity/admin-queries";
import { adminListTickets } from "@/domains/assist";
import { DashboardView } from "./dashboard-view";

export default async function AdminDashboardPage() {
  const [stats, pendingKyc, openTickets, totalUsers] = await Promise.all([
    adminDashboardStats(),
    adminListUsers({ kycStatus: "pending" }),
    adminListTickets("open"),
    adminListUsers(),
  ]);

  return (
    <DashboardView
      stats={stats}
      pendingKycCount={pendingKyc.total}
      openTicketsCount={openTickets.total}
      totalUsersCount={totalUsers.total}
    />
  );
}
