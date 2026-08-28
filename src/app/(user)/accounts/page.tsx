import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getLinkedAccountsWithBalances } from "@/domains/accounts/queries";
import { AccountsView } from "./accounts-view";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const accounts = await getLinkedAccountsWithBalances(user.id);

  return <AccountsView accounts={accounts} />;
}
