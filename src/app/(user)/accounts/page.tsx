import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getLinkedAccounts } from "@/domains/accounts/queries";
import { getProviderAdapter } from "@/domains/providers/registry";
import { AccountsView } from "./accounts-view";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const linkedAccounts = await getLinkedAccounts(user.id);

  const accounts = await Promise.all(
    linkedAccounts.map(async (account) => {
      if (account.status !== "active") {
        return { ...account, balance: null };
      }
      try {
        const adapter = getProviderAdapter(account.provider);
        const balance = await adapter.getBalance(account.external_reference);
        return { ...account, balance };
      } catch {
        return { ...account, balance: null };
      }
    })
  );

  return <AccountsView accounts={accounts} />;
}
