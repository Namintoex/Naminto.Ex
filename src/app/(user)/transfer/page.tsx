import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getLinkedAccounts } from "@/domains/accounts/queries";
import { getWalletBalances } from "@/domains/payments/ledger";
import { TransferWizard } from "./transfer-wizard";

/**
 * Dépôt (compte lié → portefeuille) et retrait (portefeuille → compte
 * lié) — même titulaire des deux côtés, jamais un envoi à un tiers.
 * Le Routing (Prompt 09), le Ledger (ADR-039) et le Risk Engine (un
 * compte lié du titulaire n'est jamais un "bénéficiaire") supportent ces
 * deux combinaisons depuis leur construction d'origine ; seule l'UI
 * manquait — voir docs/DECISIONS.md ADR-061.
 */
export default async function TransferPage({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string; account?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { direction, account } = await searchParams;
  if (direction !== "deposit" && direction !== "withdraw") {
    notFound();
  }

  const linkedAccounts = await getLinkedAccounts(user.id);
  const activeLinkedAccounts = linkedAccounts
    .filter((a) => a.status === "active")
    .map((a) => ({ id: a.id, provider: a.provider, externalReference: a.external_reference }));

  // Jamais fait confiance à l'id brut de l'URL — revérifié contre les
  // comptes actifs du titulaire (même principe que `source` sur /send).
  const initialAccountId = activeLinkedAccounts.some((a) => a.id === account) ? account! : null;

  const walletBalances = direction === "withdraw" ? await getWalletBalances(user.id) : [];

  return (
    <TransferWizard
      direction={direction}
      linkedAccounts={activeLinkedAccounts}
      initialAccountId={initialAccountId}
      walletBalances={walletBalances}
    />
  );
}
