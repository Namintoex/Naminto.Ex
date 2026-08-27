import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderAdapter } from "@/domains/providers/registry";
import { ALL_CHECKS } from "./checks";
import type {
  DetectedAnomaly,
  LedgerView,
  ProviderView,
  ReconcileTransactionResult,
  ReconciliationAnomalyType,
  SettlementView,
} from "./types";
import type { Database, Provider } from "@/lib/supabase/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionStatus = Transaction["status"];
type AdminClient = ReturnType<typeof createAdminClient>;

async function buildLedgerView(admin: AdminClient, transactionId: string): Promise<LedgerView> {
  const { data } = await admin
    .from("ledger_entries")
    .select("account_id, direction, amount")
    .eq("transaction_id", transactionId);

  const entries = (data ?? []).map((e) => ({ accountId: e.account_id, direction: e.direction, amount: Number(e.amount) }));
  const totalDebit = entries.filter((e) => e.direction === "debit").reduce((sum, e) => sum + e.amount, 0);
  const totalCredit = entries.filter((e) => e.direction === "credit").reduce((sum, e) => sum + e.amount, 0);

  return { entryCount: entries.length, totalDebit, totalCredit, entries };
}

async function buildProviderView(tx: Transaction): Promise<ProviderView> {
  if (!tx.provider || !tx.provider_transaction_id) {
    return { checked: false, providerTransactionId: null, status: null };
  }

  try {
    const adapter = getProviderAdapter(tx.provider as Provider);
    const result = await adapter.getTransactionStatus(tx.provider_transaction_id);
    return { checked: true, providerTransactionId: tx.provider_transaction_id, status: result.status, reason: result.reason };
  } catch (err) {
    // Un fournisseur injoignable n'est pas une anomalie de rapprochement
    // (c'est le rôle de l'Availability Engine, Prompt 47) — ne bloque
    // jamais la réconciliation des autres vérifications.
    return {
      checked: false,
      providerTransactionId: tx.provider_transaction_id,
      status: null,
      reason: (err as Error).message,
    };
  }
}

function buildSettlementView(tx: Transaction): SettlementView {
  const amount = Number(tx.amount);
  const fee = Number(tx.fee);
  return {
    status: tx.status,
    amount,
    fee,
    total: Number(tx.total),
    feePayer: tx.fee_payer,
    expectedSenderDebit: tx.fee_payer === "sender" ? amount + fee : amount,
  };
}

/**
 * Réconcilie une transaction unique (Prompt 24) — appelée juste après
 * règlement (orchestrator-steps/reconciliation.ts) et par le lot manuel
 * (`runReconciliation`). N'écrit jamais dans `ledger_entries`/
 * `ledger_accounts` : seulement des lignes `reconciliation_anomalies`.
 * Idempotente au niveau anomalie : ne recrée jamais un doublon d'un type
 * déjà ouvert/en cours d'investigation pour la même transaction.
 */
export async function reconcileTransaction(transactionId: string): Promise<ReconcileTransactionResult | null> {
  const admin = createAdminClient();

  const { data: tx } = await admin.from("transactions").select("*").eq("id", transactionId).maybeSingle();
  if (!tx) return null;

  const [ledger, provider] = await Promise.all([buildLedgerView(admin, transactionId), buildProviderView(tx)]);
  const settlement = buildSettlementView(tx);

  const detected = ALL_CHECKS.map((check) => check(settlement, ledger, provider)).filter(
    (a): a is DetectedAnomaly => a !== null
  );

  const { data: existingOpen } = await admin
    .from("reconciliation_anomalies")
    .select("type")
    .eq("transaction_id", transactionId)
    .in("status", ["open", "investigating"]);
  const existingOpenTypes = new Set((existingOpen ?? []).map((a) => a.type));

  const anomalies: DetectedAnomaly[] = [];
  const skippedExisting: ReconciliationAnomalyType[] = [];

  for (const anomaly of detected) {
    if (existingOpenTypes.has(anomaly.type)) {
      skippedExisting.push(anomaly.type);
      continue;
    }
    const { error } = await admin.from("reconciliation_anomalies").insert({
      transaction_id: transactionId,
      type: anomaly.type,
      details: anomaly.details as unknown as Record<string, unknown>,
    });
    if (!error) anomalies.push(anomaly);
  }

  return { transactionId, reference: tx.reference, anomalies, skippedExisting };
}

const RECONCILABLE_STATUSES: TransactionStatus[] = ["settled", "failed", "rejected", "cancelled", "expired"];

export interface RunReconciliationSummary {
  checked: number;
  anomaliesCreated: number;
}

/**
 * Lot manuel (Prompt 24, Back Office) — vérifie les transactions
 * terminales les plus récentes. Aucun ordonnanceur/cron n'existe dans ce
 * dépôt : ce lot est déclenché à la demande (bouton Back Office), pas
 * automatiquement sur un horaire — voir docs/DECISIONS.md ADR-052.
 */
export async function runReconciliation(limit = 200): Promise<RunReconciliationSummary> {
  const admin = createAdminClient();
  const { data: transactions } = await admin
    .from("transactions")
    .select("id")
    .in("status", RECONCILABLE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(limit);

  let anomaliesCreated = 0;
  for (const tx of transactions ?? []) {
    const result = await reconcileTransaction(tx.id);
    anomaliesCreated += result?.anomalies.length ?? 0;
  }

  return { checked: transactions?.length ?? 0, anomaliesCreated };
}
