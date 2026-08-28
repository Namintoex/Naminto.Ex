import "server-only";
import { sendNotification } from "@/domains/notifications";
import type { Database } from "@/lib/supabase/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

/**
 * Étape 10 — Notification (Prompt 20). Remplace le STUB posé au Prompt 09.
 * `sendNotification` ne lève déjà jamais (voir notifications/send-notification.ts),
 * mais l'appelant (orchestrator.ts) encapsule quand même cet appel dans
 * son propre try/catch, en défense en profondeur explicite au point
 * exact où la contrainte s'applique (« une panne SMS ne doit jamais
 * annuler une transaction financière déjà confirmée »).
 */
/**
 * `skipUserIds` (revue de code) : un règlement portefeuille-à-portefeuille
 * notifie DEUX destinataires indépendants (expéditeur et destinataire).
 * Le consumer d'événement (Prompt 26) ne peut garantir l'idempotence
 * qu'au grain de chaque destinataire, pas au grain de l'événement entier
 * — sans ce paramètre, un retry après une interruption entre les deux
 * envois (fonction tuée, timeout) retrouvait la notification de
 * l'expéditeur déjà écrite et sautait tout le traitement, y compris
 * l'envoi — jamais rejoué — au destinataire.
 */
export async function notifyTransactionSettled(transaction: Transaction, skipUserIds: ReadonlySet<string> = new Set()): Promise<void> {
  const notifications: Promise<unknown>[] = [];

  if (transaction.sender_user_id && !skipUserIds.has(transaction.sender_user_id)) {
    notifications.push(
      sendNotification({
        type: "transaction_settled",
        userId: transaction.sender_user_id,
        data: {
          reference: transaction.reference,
          amount: Number(transaction.amount),
          currency: transaction.currency,
          direction: "sent",
        },
      })
    );
  }

  if (
    transaction.destination_type === "naminto_wallet" &&
    transaction.recipient_user_id &&
    !skipUserIds.has(transaction.recipient_user_id)
  ) {
    notifications.push(
      sendNotification({
        type: "transaction_settled",
        userId: transaction.recipient_user_id,
        data: {
          reference: transaction.reference,
          amount: Number(transaction.amount),
          currency: transaction.currency,
          direction: "received",
        },
      })
    );
  }

  // Destinataires indépendants : en parallèle, pas en série.
  await Promise.all(notifications);
}

export async function notifyTransactionFailed(transaction: Transaction, reasonCode: string): Promise<void> {
  if (!transaction.sender_user_id) return;

  await sendNotification({
    type: "transaction_failed",
    userId: transaction.sender_user_id,
    data: {
      reference: transaction.reference,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      reasonCode,
    },
  });
}
