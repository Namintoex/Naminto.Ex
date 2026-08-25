import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile } from "@/domains/identity/queries";
import type { Database } from "@/lib/supabase/database.types";
import type { CounterpartyInfo, TransactionFilters } from "./types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type StatusEventRow = Database["public"]["Tables"]["transaction_status_events"]["Row"];
type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];

const PAGE_SIZE = 20;

export interface ListTransactionsResult {
  transactions: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Liste les transactions du titulaire — passe par le client RLS
 * (`transactions_select_participant`, 0005_transactions.sql) plutôt que
 * service_role : la policy fait déjà exactement le filtrage nécessaire
 * (expéditeur ou destinataire), inutile d'élever les privilèges pour de
 * la simple lecture d'historique.
 */
export async function listTransactions(
  userId: string,
  filters: TransactionFilters,
  page = 1
): Promise<ListTransactionsResult> {
  const supabase = await createClient();
  let query = supabase.from("transactions").select("*", { count: "exact" });

  if (filters.direction === "sent") {
    query = query.eq("sender_user_id", userId);
  } else if (filters.direction === "received") {
    query = query.eq("recipient_user_id", userId);
  } else {
    query = query.or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`);
  }

  if (filters.reference) {
    query = query.ilike("reference", `%${filters.reference.trim()}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters.to) {
    // Borne incluse sur toute la journée `to`.
    query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  }

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);

  return { transactions: data ?? [], total: count ?? 0, page: safePage, pageSize: PAGE_SIZE };
}

/**
 * Retrouve une transaction par sa référence exacte (Prompt 16 : « chaque
 * transaction doit pouvoir être retrouvée par sa référence »). La policy
 * RLS restreint déjà l'accès aux seuls participants — un utilisateur qui
 * saisit la référence de la transaction de quelqu'un d'autre reçoit
 * `null`, jamais une fuite d'information.
 */
export async function getTransactionByReference(reference: string): Promise<TransactionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("reference", reference.trim().toUpperCase())
    .maybeSingle();
  return data;
}

/**
 * La timeline (Prompt 16) est directement `transaction_status_events`
 * (append-only depuis le Prompt 08) — jamais reconstruite ou approximée.
 */
export async function getTransactionTimeline(transactionId: string): Promise<StatusEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transaction_status_events")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * Écritures Ledger visibles par le titulaire pour cette transaction —
 * utilisé pour que le reçu (Prompt 16 : « cohérent avec le Ledger »)
 * puisse afficher une confirmation quand elle existe réellement.
 * `ledger_accounts_select_own_wallet` (0008_ledger.sql) ne couvre que
 * les comptes `user_wallet` : pour une transaction dont le côté du
 * titulaire est un compte lié externe (Send Money vers un bénéficiaire
 * externe), aucune écriture n'est visible ici — absence normale, pas une
 * anomalie (voir docs/DECISIONS.md).
 */
export async function getMyLedgerEntriesForTransaction(transactionId: string): Promise<LedgerEntryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("ledger_entries").select("*").eq("transaction_id", transactionId);
  return data ?? [];
}

/**
 * Résout l'« autre partie » d'une transaction du point de vue du
 * titulaire consultant l'historique — jamais une valeur inventée : un
 * profil introuvable reste « — », jamais un nom substitué.
 */
export async function resolveCounterparty(tx: TransactionRow, viewerId: string): Promise<CounterpartyInfo> {
  const isSender = tx.sender_user_id === viewerId;

  if (isSender) {
    if (tx.destination_type === "naminto_wallet" && tx.recipient_user_id) {
      const profile = await getPublicProfile(tx.recipient_user_id);
      return { kind: "user", label: profile?.legalName ?? "—" };
    }
    if (tx.destination_type === "external") {
      return { kind: "external", label: tx.destination_external_reference ?? "—" };
    }
    // destination_type === 'linked_account' : compte lié du titulaire
    // lui-même (encaissement), pas une autre personne.
    return { kind: "own_linked_account", label: tx.provider ?? "—" };
  }

  if (tx.source_type === "naminto_wallet" && tx.sender_user_id) {
    const profile = await getPublicProfile(tx.sender_user_id);
    return { kind: "user", label: profile?.legalName ?? "—" };
  }
  return { kind: "external", label: tx.provider ?? "—" };
}
