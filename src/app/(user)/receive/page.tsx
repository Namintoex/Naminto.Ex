import { redirect } from "next/navigation";
import { getCurrentUser, getIdentityProfile } from "@/domains/identity/queries";
import { generateQrSvg } from "@/lib/qr";
import { getRequestOrigin } from "@/lib/request-origin";
import { encodeQr, BENEFICIARY_QR_TTL_MS } from "@/domains/qr-engine";
import { ReceiveView } from "./receive-view";

export default async function ReceivePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getIdentityProfile(user.id);
  if (!profile) {
    redirect("/login");
  }

  const now = Date.now();
  const encoded = encodeQr({
    v: 1,
    type: "BENEFICIARY",
    iat: now,
    exp: now + BENEFICIARY_QR_TTL_MS,
    namintoId: profile.naminto_id,
  });
  const origin = await getRequestOrigin();
  const qrSvg = await generateQrSvg(`${origin}/qr/${encoded}`);

  return <ReceiveView namintoId={profile.naminto_id} legalName={profile.legal_name} qrSvg={qrSvg} />;
}
