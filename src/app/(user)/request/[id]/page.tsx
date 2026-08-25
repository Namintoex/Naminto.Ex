import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getMoneyRequestById } from "@/domains/payments/money-requests";
import { generateQrSvg } from "@/lib/qr";
import { getRequestOrigin } from "@/lib/request-origin";
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

  const origin = await getRequestOrigin();
  const shareLink = `${origin}/pay/${request.token}`;
  const qrSvg = await generateQrSvg(shareLink);

  return <RequestDetailView request={request} shareLink={shareLink} qrSvg={qrSvg} />;
}
