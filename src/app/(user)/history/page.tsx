import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { listTransactions, resolveCounterparty } from "@/domains/payments/history";
import type { TransactionFilters } from "@/domains/payments/history/types";
import { TRANSACTION_STATUSES, type TransactionStatus } from "@/domains/payments/transaction-status";
import { HistoryView } from "./history-view";

function isTransactionStatus(value: string | undefined): value is TransactionStatus {
  return Boolean(value) && (TRANSACTION_STATUSES as string[]).includes(value as string);
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    direction?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const filters: TransactionFilters = {
    reference: sp.q?.trim() || undefined,
    status: isTransactionStatus(sp.status) ? sp.status : undefined,
    direction: sp.direction === "sent" ? "sent" : sp.direction === "received" ? "received" : undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
  };

  const result = await listTransactions(user.id, filters, page);
  const rows = await Promise.all(
    result.transactions.map(async (tx) => ({ tx, counterparty: await resolveCounterparty(tx, user.id) }))
  );

  return (
    <HistoryView
      rows={rows}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      filters={{ q: sp.q ?? "", status: sp.status ?? "", direction: sp.direction ?? "", from: sp.from ?? "", to: sp.to ?? "" }}
    />
  );
}
