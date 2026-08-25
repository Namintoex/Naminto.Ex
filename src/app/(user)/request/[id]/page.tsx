import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getIdentityProfile } from "@/domains/identity/queries";
import { getMoneyRequestById } from "@/domains/payments/money-requests";
import { generateQrSvg } from "@/lib/qr";
import { getRequestOrigin } from "@/lib/request-origin";
import { encodeQr } from "@/domains/qr-engine";
import { RequestDetailView } from "./request-detail-view";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const request = await getMoneyRequestById(id);
  if (!request || request.requester_user_id !== user.id) {
    notFound();
  }

  const profile = await getIdentityProfile(user.id);
  if (!profile) {
    redirect("/login");
  }

  const origin = await getRequestOrigin();
  const shareLink = `${origin}/pay/${request.token}`;

  const encoded = encodeQr({
    v: 1,
    type: "PAYMENT_REQUEST",
    iat: Date.now(),
    exp: new Date(request.expires_at).getTime(),
    token: request.token,
    amount: Number(request.amount),
    currency: request.currency,
    requesterNamintoId: profile.naminto_id,
  });
  const qrSvg = await generateQrSvg(`${origin}/qr/${encoded}`);

  return <RequestDetailView request={request} shareLink={shareLink} qrSvg={qrSvg} />;
}
