import { notFound } from "next/navigation";
import { adminGetUserDetail } from "@/domains/identity/admin-queries";
import { getUserPermissions, requirePermission } from "@/domains/rbac";
import { UserDetailView } from "./user-detail-view";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requirePermission("user.read");

  const { id } = await params;
  const [detail, permissions] = await Promise.all([adminGetUserDetail(id), getUserPermissions(userId)]);
  if (!detail) {
    notFound();
  }

  return <UserDetailView detail={detail} canSuspend={permissions.has("user.suspend")} />;
}
