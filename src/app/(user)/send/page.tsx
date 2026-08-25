import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getLinkedAccounts } from "@/domains/accounts/queries";
import { SendMoneyWizard } from "./send-money-wizard";

export default async function SendPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const linkedAccounts = await getLinkedAccounts(user.id);
  const activeLinkedAccounts = linkedAccounts
    .filter((account) => account.status === "active")
    .map((account) => ({
      id: account.id,
      provider: account.provider,
      externalReference: account.external_reference,
    }));

  return <SendMoneyWizard linkedAccounts={activeLinkedAccounts} />;
}
