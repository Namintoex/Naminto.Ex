import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import {
  getMyLedgerEntriesForTransaction,
  getTransactionByReference,
  getTransactionTimeline,
  resolveCounterparty,
} from "@/domains/payments/history";
import { TransactionNotFoundView } from "./transaction-not-found-view";
import { TransactionDetailView } from "./transaction-detail-view";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const tx = await getTransactionByReference(reference);
  if (!tx) {
    return <TransactionNotFoundView />;
  }

  const [timeline, ledgerEntries, counterparty] = await Promise.all([
    getTransactionTimeline(tx.id),
    getMyLedgerEntriesForTransaction(tx.id),
    resolveCounterparty(tx, user.id),
  ]);

  const direction = tx.sender_user_id === user.id ? "sent" : "received";

  return (
    <TransactionDetailView
      tx={tx}
      timeline={timeline}
      ledgerEntries={ledgerEntries}
      counterparty={counterparty}
      direction={direction}
    />
  );
}
