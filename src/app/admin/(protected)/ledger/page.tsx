import { adminListLedgerAccounts, adminListLedgerEntries } from "@/domains/payments/ledger";
import { requirePermission } from "@/domains/rbac";
import { LedgerView } from "./ledger-view";

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  await requirePermission("ledger.read");

  const sp = await searchParams;
  const [accounts, entries] = await Promise.all([
    adminListLedgerAccounts(),
    adminListLedgerEntries(sp.account),
  ]);

  return <LedgerView accounts={accounts} entries={entries} />;
}
