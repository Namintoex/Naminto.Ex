import { notFound } from "next/navigation";
import { adminGetTransactionDetail } from "@/domains/payments/history";
import { requirePermission } from "@/domains/rbac";
import { TransactionDetailView } from "./transaction-detail-view";

export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  await requirePermission("transaction.read");

  const { reference } = await params;
  const detail = await adminGetTransactionDetail(reference);
  if (!detail) {
    notFound();
  }

  return <TransactionDetailView detail={detail} />;
}
