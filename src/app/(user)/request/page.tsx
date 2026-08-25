import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { listOwnMoneyRequests } from "@/domains/payments/money-requests";
import { RequestMoneyView } from "./request-money-view";

export default async function RequestPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const requests = await listOwnMoneyRequests(user.id);

  return <RequestMoneyView requests={requests} />;
}
