import { redirect } from "next/navigation";
import { getCurrentUser, getIdentityProfile } from "@/domains/identity/queries";
import { generateQrSvg } from "@/lib/qr";
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

  const qrSvg = await generateQrSvg(profile.naminto_id);

  return <ReceiveView namintoId={profile.naminto_id} legalName={profile.legal_name} qrSvg={qrSvg} />;
}
