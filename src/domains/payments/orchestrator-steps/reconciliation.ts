import "server-only";

/**
 * Étape 11 — Reconciliation. STUB : le Reconciliation Engine réel
 * (comparaison Ledger vs Fournisseur vs Settlement — Prompt 24) est un
 * traitement asynchrone/batch, pas une étape synchrone du pipeline.
 * Cette fonction ne fait qu'acter le point d'entrée futur.
 */
export async function scheduleReconciliation(transactionId: string): Promise<void> {
  console.info("[reconciliation:stub] rapprochement différé au Prompt 24", { transactionId });
}
