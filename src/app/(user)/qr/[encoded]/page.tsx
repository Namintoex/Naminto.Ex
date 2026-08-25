import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { resolveBeneficiary, resolvePrefilledPayment, verifyQr } from "@/domains/qr-engine";
import { QrErrorView } from "./qr-error-view";
import { PrefilledPaymentView } from "./prefilled-payment-view";

/**
 * Point d'entrée unique du QR Engine (Prompt 15) — étapes « decode » et
 * « validate » du cycle obligatoire (decode → validate → resolve →
 * display → confirm → authenticate → execute). Jamais de « scan →
 * execute » : chaque branche exige au minimum une confirmation
 * explicite ; celles qui déplacent de l'argent exigent en plus le PIN.
 */
export default async function QrPage({ params }: { params: Promise<{ encoded: string }> }) {
  const { encoded } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/qr/${encoded}`)}`);
  }

  const decoded = verifyQr(encoded);
  if (!decoded.ok) {
    return <QrErrorView reason={decoded.reason} />;
  }
  const { payload } = decoded;

  // REQUEST et PAYMENT_REQUEST référencent le même objet money_requests
  // (Prompt 14) — leur page dédiée /pay/[token] implémente déjà resolve
  // → display → confirm → authenticate → execute, jamais dupliquée ici.
  if (payload.type === "REQUEST" || payload.type === "PAYMENT_REQUEST") {
    redirect(`/pay/${payload.token}`);
  }

  if (payload.type === "BENEFICIARY") {
    const recipient = await resolveBeneficiary(payload);
    if (!recipient) {
      return <QrErrorView reason="invalid_payload" />;
    }
    redirect(`/send?to=${encodeURIComponent(recipient.namintoId)}`);
  }

  // PREFILLED_PAYMENT : seul type sans page dédiée préexistante —
  // resolve + affichage + confirmation + PIN directement ici.
  const recipient = await resolvePrefilledPayment(payload);
  if (!recipient) {
    return <QrErrorView reason="invalid_payload" />;
  }

  return (
    <PrefilledPaymentView
      raw={encoded}
      payload={payload}
      recipientName={recipient.legalName}
      isSelf={payload.recipientUserId === user.id}
    />
  );
}
