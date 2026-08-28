import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/domains/event-bus";
import { getOrCreateLedgerAccount } from "./accounts";
import {
  LedgerCurrencyMismatchError,
  LedgerImbalanceError,
  LedgerInvalidAmountError,
  LedgerMissingSettlementError,
  LedgerTransactionNotFoundError,
  type LedgerEntryInput,
  type LedgerEntryKind,
} from "./types";
import type { Database, DestinationType, Provider, SourceType } from "@/lib/supabase/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compte "expéditeur" logique : là d'où la valeur sort. `naminto_wallet`
 * pointe vers le portefeuille de l'utilisateur ; `linked_account` pointe
 * vers un compte de transit du fournisseur (l'argent transite par son
 * rail avant d'entrer dans le système — voir docs/DECISIONS.md).
 */
function sourceAccountRef(tx: Pick<Transaction, "source_type" | "sender_user_id" | "provider" | "currency">) {
  const sourceType = tx.source_type as SourceType;
  if (sourceType === "naminto_wallet") {
    return { ownerType: "user_wallet" as const, ownerId: tx.sender_user_id, currency: tx.currency };
  }
  return { ownerType: "provider_suspense" as const, provider: tx.provider as Provider, currency: tx.currency };
}

/**
 * Compte "destinataire" logique : là où la valeur arrive. `external`
 * (hors Naminto.Ex et hors rail fournisseur modélisé) est capturé par un
 * compte de transit générique, faute de destination plus précise dans
 * les documents source — voir docs/DECISIONS.md (TODO_DECISION).
 */
function destinationAccountRef(tx: Pick<Transaction, "destination_type" | "recipient_user_id" | "provider" | "currency">) {
  const destinationType = tx.destination_type as DestinationType;
  if (destinationType === "naminto_wallet") {
    return { ownerType: "user_wallet" as const, ownerId: tx.recipient_user_id, currency: tx.currency };
  }
  if (destinationType === "linked_account") {
    return { ownerType: "provider_suspense" as const, provider: tx.provider as Provider, currency: tx.currency };
  }
  return { ownerType: "external_suspense" as const, currency: tx.currency };
}

function feeRevenueAccountRef(currency: string) {
  return { ownerType: "fee_revenue" as const, currency };
}

/**
 * Écrit un lot d'écritures équilibré (Prompt 12, comptabilité en partie
 * double) en une seule insertion atomique. Rejette tout lot déséquilibré,
 * multi-devise, ou contenant un montant non strictement positif — avant
 * même d'atteindre les contraintes de base (défense en profondeur,
 * même logique que transaction-status.ts).
 */
export async function writeBalancedEntries(
  transactionId: string,
  kind: LedgerEntryKind,
  reference: string,
  entries: LedgerEntryInput[]
): Promise<LedgerEntryRow[]> {
  const currency = entries[0]?.currency;
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    if (entry.currency !== currency) throw new LedgerCurrencyMismatchError();
    if (!(entry.amount > 0)) throw new LedgerInvalidAmountError(entry.amount);
    if (entry.direction === "debit") totalDebit = round2(totalDebit + entry.amount);
    else totalCredit = round2(totalCredit + entry.amount);
  }
  if (totalDebit !== totalCredit) throw new LedgerImbalanceError(totalDebit, totalCredit);

  const admin = createAdminClient();
  const accountIds = await Promise.all(entries.map((entry) => getOrCreateLedgerAccount(entry.accountRef)));

  const { data, error } = await admin
    .from("ledger_entries")
    .insert(
      entries.map((entry, i) => ({
        transaction_id: transactionId,
        account_id: accountIds[i],
        kind,
        direction: entry.direction,
        amount: entry.amount,
        currency: entry.currency,
        reference,
      }))
    )
    .select("*");

  if (error || !data) {
    throw new Error(`writeBalancedEntries failed: ${error?.message ?? "unknown error"}`);
  }
  return data;
}

async function getTransactionOrThrow(admin: ReturnType<typeof createAdminClient>, transactionId: string): Promise<Transaction> {
  const { data } = await admin.from("transactions").select("*").eq("id", transactionId).maybeSingle();
  if (!data) throw new LedgerTransactionNotFoundError(transactionId);
  return data;
}

async function existingEntries(
  admin: ReturnType<typeof createAdminClient>,
  transactionId: string,
  kind: LedgerEntryKind
): Promise<LedgerEntryRow[]> {
  const { data } = await admin
    .from("ledger_entries")
    .select("*")
    .eq("transaction_id", transactionId)
    .eq("kind", kind);
  return data ?? [];
}

/**
 * Dérive les écritures de règlement (kind=settlement) d'une transaction
 * déjà `provider_confirmed` et les écrit. Idempotent : rejouer avec le
 * même transactionId ne produit jamais de deuxième lot d'écritures
 * (double-write prevention — les écritures existantes sont renvoyées
 * telles quelles).
 */
export async function recordSettlement(transactionId: string): Promise<LedgerEntryRow[]> {
  const admin = createAdminClient();
  const tx = await getTransactionOrThrow(admin, transactionId);

  const already = await existingEntries(admin, transactionId, "settlement");
  if (already.length > 0) return already;

  const fee = Number(tx.fee);
  const amount = Number(tx.amount);
  const senderDebit = tx.fee_payer === "sender" ? round2(amount + fee) : amount;
  const recipientCredit = tx.fee_payer === "recipient" ? round2(amount - fee) : amount;

  const entries: LedgerEntryInput[] = [
    { accountRef: sourceAccountRef(tx), direction: "debit", amount: senderDebit, currency: tx.currency },
    { accountRef: destinationAccountRef(tx), direction: "credit", amount: recipientCredit, currency: tx.currency },
  ];
  if (fee > 0) {
    entries.push({ accountRef: feeRevenueAccountRef(tx.currency), direction: "credit", amount: fee, currency: tx.currency });
  }

  return writeBalancedEntries(transactionId, "settlement", tx.reference, entries);
}

/**
 * Écritures miroir (débit/crédit inversés par rapport au règlement)
 * pour annuler ou rembourser une transaction déjà réglée. Nécessite que
 * le règlement existe déjà ; idempotent au même titre que
 * `recordSettlement`.
 */
async function recordMirror(transactionId: string, kind: "reversal" | "refund"): Promise<LedgerEntryRow[]> {
  const admin = createAdminClient();
  const tx = await getTransactionOrThrow(admin, transactionId);

  const already = await existingEntries(admin, transactionId, kind);
  if (already.length > 0) return already;

  const settlement = await existingEntries(admin, transactionId, "settlement");
  if (settlement.length === 0) throw new LedgerMissingSettlementError(transactionId);

  const { data: accounts } = await admin
    .from("ledger_accounts")
    .select("*")
    .in(
      "id",
      settlement.map((e) => e.account_id)
    );
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const entries: LedgerEntryInput[] = settlement.map((e) => {
    const account = accountById.get(e.account_id);
    if (!account) throw new Error(`recordMirror: compte introuvable pour l'écriture ${e.id}`);
    return {
      accountRef: {
        ownerType: account.owner_type,
        ownerId: account.owner_id,
        provider: account.provider,
        currency: account.currency,
      },
      direction: e.direction === "debit" ? "credit" : "debit",
      amount: Number(e.amount),
      currency: e.currency,
    };
  });

  const written = await writeBalancedEntries(transactionId, kind, tx.reference, entries);
  await publishEvent(
    kind === "reversal" ? "TransactionReversed" : "TransactionRefunded",
    { reference: tx.reference },
    transactionId
  );
  return written;
}

export async function recordReversal(transactionId: string): Promise<LedgerEntryRow[]> {
  return recordMirror(transactionId, "reversal");
}

export async function recordRefund(transactionId: string): Promise<LedgerEntryRow[]> {
  return recordMirror(transactionId, "refund");
}
