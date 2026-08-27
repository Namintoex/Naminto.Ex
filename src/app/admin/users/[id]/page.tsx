import { notFound } from "next/navigation";
import { adminGetUserDetail } from "@/domains/identity/admin-queries";
import { UserDetailView } from "./user-detail-view";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await adminGetUserDetail(id);
  if (!detail) {
    notFound();
  }

  return <UserDetailView detail={detail} />;
}
