import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getPublicProfile } from "@/domains/identity/queries";
import { getMoneyRequestByToken } from "@/domains/payments/money-requests";
import { PayView } from "./pay-view";

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/pay/${token}`)}`);
  }

  const request = await getMoneyRequestByToken(token);
  if (!request) {
    notFound();
  }

  const requester = await getPublicProfile(request.requester_user_id);
  if (!requester) {
    notFound();
  }

  return <PayView request={request} requesterName={requester.legalName} isSelf={request.requester_user_id === user.id} />;
}
