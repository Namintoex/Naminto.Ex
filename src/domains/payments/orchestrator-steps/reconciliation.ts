import "server-only";
import { reconcileTransaction } from "@/domains/reconciliation";

/**
 * Étape 11 — Reconciliation (Prompt 24). Réconciliation immédiate,
 * transaction par transaction, juste après règlement — aucun
 * ordonnanceur/cron n'existe dans ce dépôt pour un traitement par lot
 * différé (voir docs/DECISIONS.md ADR-052 ; un lot manuel reste
 * disponible depuis le Back Office, `runReconciliation`). Ne doit
 * jamais faire échouer l'orchestrateur : une transaction déjà réglée
 * reste réglée même si sa réconciliation échoue — même principe de
 * défense en profondeur que la Notification (Prompt 20).
 */
export async function scheduleReconciliation(transactionId: string): Promise<void> {
  try {
    await reconcileTransaction(transactionId);
  } catch (err) {
    console.error("[orchestrator] scheduleReconciliation a échoué — transaction non affectée", err);
  }
}
