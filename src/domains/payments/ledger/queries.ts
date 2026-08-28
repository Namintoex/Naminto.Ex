import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];

export interface WalletBalance {
  currency: string;
  balance: number;
}

/**
 * PostgREST plafonne une lecture sans `.range()` à 1000 lignes par défaut
 * — même précaution déjà nécessaire côté Back Office (`admin-queries.ts`,
 * un vrai solde faussé y avait été constaté au-delà de ce seuil).
 */
const FETCH_PAGE_SIZE = 1000;

async function fetchAllOwnEntryAmounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountIds: string[]
): Promise<Pick<LedgerEntryRow, "account_id" | "direction" | "amount">[]> {
  const all: Pick<LedgerEntryRow, "account_id" | "direction" | "amount">[] = [];
  let from = 0;
  for (;;) {
    const { data } = await supabase
      .from("ledger_entries")
      .select("account_id, direction, amount")
      .in("account_id", accountIds)
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }
  return all;
}

/**
 * Solde du portefeuille Naminto.Ex du titulaire connecté, par devise —
 * jamais une colonne stockée, `ledger_accounts` n'en a pas (append-only,
 * Prompt 12) : recalculé à la volée depuis `ledger_entries`, même
 * principe que le reçu (ADR-044) et le Back Office Ledger. Passe par le
 * client RLS (`ledger_accounts_select_own_wallet`/`ledger_entries_select_own`,
 * migration 0008) : la policy filtre déjà exactement ce qu'il faut,
 * jamais besoin de service_role pour une lecture du titulaire sur son
 * propre portefeuille.
 */
export async function getWalletBalances(userId: string): Promise<WalletBalance[]> {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("ledger_accounts")
    .select("id, currency")
    .eq("owner_type", "user_wallet")
    .eq("owner_id", userId);
  if (!accounts || accounts.length === 0) return [];

  const currencyByAccountId = new Map(accounts.map((a) => [a.id, a.currency]));
  const entries = await fetchAllOwnEntryAmounts(
    supabase,
    accounts.map((a) => a.id)
  );

  const balanceByCurrency = new Map<string, number>();
  for (const entry of entries) {
    const currency = currencyByAccountId.get(entry.account_id);
    if (!currency) continue;
    const delta = entry.direction === "credit" ? Number(entry.amount) : -Number(entry.amount);
    balanceByCurrency.set(currency, (balanceByCurrency.get(currency) ?? 0) + delta);
  }

  // Chaque devise pour laquelle un compte existe apparaît, même à 0 —
  // jamais absente simplement faute d'écriture pour l'instant.
  for (const currency of currencyByAccountId.values()) {
    if (!balanceByCurrency.has(currency)) balanceByCurrency.set(currency, 0);
  }

  return [...balanceByCurrency.entries()].map(([currency, balance]) => ({
    currency,
    balance: Math.round(balance * 100) / 100,
  }));
}
