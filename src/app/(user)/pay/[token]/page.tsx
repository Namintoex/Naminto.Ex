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

  // Vue restreinte transmise au composant client (revue de code) — jamais
  // requester_user_id/claimed_by_user_id/fulfilled_transaction_id/id, qui
  // sérialiseraient dans le payload RSC envoyé au navigateur de n'importe
  // quel visiteur connecté ayant le lien.
  const publicRequest = {
    token: request.token,
    amount: request.amount,
    currency: request.currency,
    note: request.note,
    status: request.status,
    expires_at: request.expires_at,
  };

  return (
    <PayView request={publicRequest} requesterName={requester.legalName} isSelf={request.requester_user_id === user.id} />
  );
}
