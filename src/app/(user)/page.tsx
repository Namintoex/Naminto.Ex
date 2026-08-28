import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getLinkedAccountsWithBalances } from "@/domains/accounts/queries";
import { getWalletBalances } from "@/domains/payments/ledger";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [walletBalances, linkedAccounts] = await Promise.all([
    getWalletBalances(user.id),
    getLinkedAccountsWithBalances(user.id),
  ]);

  return <DashboardView walletBalances={walletBalances} linkedAccounts={linkedAccounts} />;
}
