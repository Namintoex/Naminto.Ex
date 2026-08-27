import { adminListNotifications, adminDeliveryStatusBreakdown } from "@/domains/notifications";
import { requirePermission } from "@/domains/rbac";
import { NotificationsAdminView } from "./notifications-admin-view";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission("notification.read");

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const [result, breakdown] = await Promise.all([adminListNotifications(page), adminDeliveryStatusBreakdown()]);

  return <NotificationsAdminView result={result} breakdown={breakdown} />;
}
