import "server-only";

/**
 * Étape 10 — Notification. STUB : le Notification Service réel
 * (templates FR/EN, canaux IN_APP/PUSH/SMS — Prompt 20) n'existe pas
 * encore.
 */
export async function notifyTransactionSettled(transactionId: string): Promise<void> {
  console.info("[notification:stub] notification différée au Prompt 20", { transactionId });
}
