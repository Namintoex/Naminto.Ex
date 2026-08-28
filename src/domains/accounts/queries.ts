import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getProviderAdapter } from "@/domains/providers/registry";

export async function getLinkedAccounts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("linked_accounts")
    .select(
      "id, provider, external_reference, status, capabilities, consent_status, linked_at, last_synced_at, unlinked_at"
    )
    .eq("user_id", userId)
    .neq("status", "unlinked")
    .order("linked_at", { ascending: false });
  return data ?? [];
}

export type LinkedAccountWithBalance = Awaited<ReturnType<typeof getLinkedAccounts>>[number] & {
  balance: { amount: number; currency: string } | null;
};

/**
 * `getLinkedAccounts` enrichi du solde SANDBOX réel de chaque compte actif
 * (Provider Gateway, Prompt 07) — factorisé ici pour ne pas dupliquer cette
 * boucle entre `/accounts` et le tableau de bord.
 */
export async function getLinkedAccountsWithBalances(userId: string): Promise<LinkedAccountWithBalance[]> {
  const linkedAccounts = await getLinkedAccounts(userId);
  return Promise.all(
    linkedAccounts.map(async (account) => {
      if (account.status !== "active") {
        return { ...account, balance: null };
      }
      try {
        const adapter = getProviderAdapter(account.provider);
        const balance = await adapter.getBalance(account.external_reference);
        return { ...account, balance };
      } catch {
        return { ...account, balance: null };
      }
    })
  );
}
