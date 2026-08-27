import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type LedgerAccountRow = Database["public"]["Tables"]["ledger_accounts"]["Row"];
type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];

export interface LedgerAccountWithBalance extends LedgerAccountRow {
  /** Somme(crédits) − Somme(débits) — jamais une colonne stockée, `ledger_accounts` n'en a pas (append-only, Prompt 12). */
  balance: number;
}

/**
 * Back Office — Ledger (Prompt 22). Lecture seule : le Ledger reste
 * append-only (ADR-038), aucune écriture n'est jamais exposée ici. Le
 * solde est recalculé à la volée depuis `ledger_entries`, jamais stocké
 * — même principe que le reçu (Prompt 16, ADR-044) : ne jamais faire
 * confiance à une valeur dénormalisée quand la source append-only est
 * disponible.
 */
const FETCH_PAGE_SIZE = 1000;

/**
 * PostgREST plafonne une lecture sans `.range()` à 1000 lignes par
 * défaut — silencieusement, sans erreur. `ledger_entries` étant
 * append-only et donc croissant sans borne, une lecture naïve fausserait
 * le solde dès que la table dépasse ce seuil (repéré concrètement : 1007
 * lignes accumulées par la suite de tests, solde calculé faux pour les
 * comptes les plus récents). Pagine donc explicitement jusqu'à tout lire.
 */
async function fetchAllLedgerEntryAmounts(
  admin: ReturnType<typeof createAdminClient>
): Promise<Pick<LedgerEntryRow, "account_id" | "direction" | "amount">[]> {
  const all: Pick<LedgerEntryRow, "account_id" | "direction" | "amount">[] = [];
  let from = 0;
  for (;;) {
    const { data } = await admin
      .from("ledger_entries")
      .select("account_id, direction, amount")
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }
  return all;
}

export async function adminListLedgerAccounts(): Promise<LedgerAccountWithBalance[]> {
  const admin = createAdminClient();
  const [{ data: accounts }, entries] = await Promise.all([
    admin.from("ledger_accounts").select("*").order("created_at", { ascending: false }),
    fetchAllLedgerEntryAmounts(admin),
  ]);

  const balanceByAccount = new Map<string, number>();
  for (const entry of entries) {
    const delta = entry.direction === "credit" ? Number(entry.amount) : -Number(entry.amount);
    balanceByAccount.set(entry.account_id, (balanceByAccount.get(entry.account_id) ?? 0) + delta);
  }

  return (accounts ?? []).map((account) => ({
    ...account,
    balance: Math.round((balanceByAccount.get(account.id) ?? 0) * 100) / 100,
  }));
}

export async function adminListLedgerEntries(accountId?: string, limit = 50): Promise<LedgerEntryRow[]> {
  const admin = createAdminClient();
  let query = admin.from("ledger_entries").select("*");
  if (accountId) {
    query = query.eq("account_id", accountId);
  }
  const { data } = await query.order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}
