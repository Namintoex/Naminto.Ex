import { redirect } from "next/navigation";
import { getCurrentUser, findRecipientByNamintoId } from "@/domains/identity/queries";
import { getLinkedAccounts } from "@/domains/accounts/queries";
import { SendMoneyWizard } from "./send-money-wizard";

export default async function SendPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { to } = await searchParams;

  const linkedAccounts = await getLinkedAccounts(user.id);
  const activeLinkedAccounts = linkedAccounts
    .filter((account) => account.status === "active")
    .map((account) => ({
      id: account.id,
      provider: account.provider,
      externalReference: account.external_reference,
    }));

  // Bénéficiaire prérempli (QR Engine, Prompt 15 — type BENEFICIARY) :
  // résolu ici, côté serveur, plutôt que rejoué côté client — la
  // vérification a déjà eu lieu dans /qr/[encoded], mais on ne fait
  // jamais confiance à un paramètre d'URL sans le revalider.
  const prefilledRecipient =
    to && to.trim() && to.trim().toLowerCase() !== "" ? await findRecipientByNamintoId(to) : null;
  const initialRecipient =
    prefilledRecipient && prefilledRecipient.userId !== user.id
      ? { namintoId: prefilledRecipient.namintoId, legalName: prefilledRecipient.legalName, userId: prefilledRecipient.userId }
      : null;

  return <SendMoneyWizard linkedAccounts={activeLinkedAccounts} initialRecipient={initialRecipient} />;
}
