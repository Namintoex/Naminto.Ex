import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateFee } from "@/domains/payments/fee-engine";
import { NoMatchingFeeRuleError } from "@/domains/payments/fee-engine/types";
import type { Database } from "@/lib/supabase/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type StatusEventRow = Database["public"]["Tables"]["transaction_status_events"]["Row"];

export interface FeeExplanation {
  amount: number;
  fee: number;
  currency: string;
}

/**
 * « Expliquer les frais » (Prompt 21) — délègue entièrement au Fee
 * Engine (Prompt 10) : jamais un taux recalculé ou approximé ici. `null`
 * si aucune règle ne correspond (ex. devise inconnue) — l'assistant
 * l'explique honnêtement plutôt que d'inventer un chiffre.
 */
export async function explainFeeForAmount(amount: number, currency = "XOF"): Promise<FeeExplanation | null> {
  try {
    const result = await calculateFee({ amount, currency });
    return { amount, fee: result.fee, currency };
  } catch (err) {
    if (err instanceof NoMatchingFeeRuleError) return null;
    throw err;
  }
}

export interface TransactionDiagnosis {
  transaction: TransactionRow;
  latestReason: string | null;
}

/**
 * « Diagnostiquer » (Prompt 21) — passe par le client RLS
 * (`transactions_select_participant`), jamais service_role : un
 * utilisateur ne doit jamais pouvoir diagnostiquer la transaction d'un
 * tiers depuis le chat, même en devinant une référence. `null` si
 * introuvable ou non accessible — jamais de distinction entre les deux
 * dans la réponse (pas de fuite d'information sur l'existence d'une
 * référence).
 */
export async function diagnoseTransaction(reference: string, userId: string): Promise<TransactionDiagnosis | null> {
  const supabase = await createClient();
  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("reference", reference.trim().toUpperCase())
    .maybeSingle();

  if (!transaction) return null;
  if (transaction.sender_user_id !== userId && transaction.recipient_user_id !== userId) return null;

  let latestReason: string | null = null;
  const isFailureLike = ["failed", "rejected", "cancelled", "expired", "disputed"].includes(transaction.status);
  if (isFailureLike) {
    const { data: events } = await supabase
      .from("transaction_status_events")
      .select("*")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: false })
      .limit(1);
    latestReason = (events as StatusEventRow[] | null)?.[0]?.reason ?? null;
  }

  return { transaction, latestReason };
}

const SEARCH_LIMIT = 5;

/**
 * « Rechercher » (Prompt 21) — un message libre ("je cherche une
 * transaction") ne contient pas toujours un terme fiable à faire
 * correspondre (voir intent-detector.ts : une référence exacte NEX-xxx
 * est déjà traitée en priorité par diagnose_transaction). Se contente
 * donc de renvoyer l'activité récente du titulaire, jamais une
 * correspondance approximative sur un texte libre. Même policy RLS que
 * l'historique (Prompt 16).
 */
export async function listRecentTransactionsForAssist(userId: string): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(SEARCH_LIMIT);
  return data ?? [];
}
