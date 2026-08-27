import { adminListTransactions } from "@/domains/payments/history";
import { requirePermission } from "@/domains/rbac";
import { TRANSACTION_STATUSES, type TransactionStatus } from "@/domains/payments/transaction-status";
import { TransactionsView } from "./transactions-view";

function isTransactionStatus(value: string | undefined): value is TransactionStatus {
  return Boolean(value) && (TRANSACTION_STATUSES as string[]).includes(value as string);
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requirePermission("transaction.read");

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const result = await adminListTransactions(
    { reference: sp.q, status: isTransactionStatus(sp.status) ? sp.status : undefined },
    page
  );

  return <TransactionsView result={result} filters={{ q: sp.q ?? "", status: sp.status ?? "" }} />;
}
