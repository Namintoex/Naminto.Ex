import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTransactionFailed, notifyTransactionSettled } from "@/domains/payments/orchestrator-steps/notification";
import type { Database } from "@/lib/supabase/database.types";
import { registerConsumer } from "../registry";
import type { DomainEvent } from "../types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type AdminClient = ReturnType<typeof createAdminClient>;

interface NotificationRequestedPayload {
  kind: "settled" | "failed";
  transaction: Transaction;
  errorCode?: string;
}

/**
 * `sendNotification` (Prompt 20) insère toujours une nouvelle ligne
 * `notifications`, sans déduplication — correct pour un appel unique,
 * mais un retry de livraison (Prompt 26) rejouerait `handle` en entier.
 * Cette vérification est la garantie d'idempotence propre à CE consumer
 * (exigence explicite du prompt « chaque consumer doit être idempotent »),
 * au-dessus de la garantie infrastructurelle (un consumer n'est jamais
 * enregistré deux fois pour le même événement) qui ne couvre pas le cas
 * d'un retry après un premier succès partiel.
 *
 * Grain PAR DESTINATAIRE, pas par événement (revue de code) : un
 * règlement portefeuille-à-portefeuille notifie deux utilisateurs
 * indépendants (expéditeur et destinataire) pour la même `reference` —
 * vérifier seulement `event_type`+`reference` faisait sauter tout
 * `handle()`, y compris l'envoi jamais tenté au second destinataire, dès
 * qu'un seul des deux avait déjà sa ligne (retry après une interruption
 * entre les deux envois).
 */
async function notifiedUserIds(
  admin: AdminClient,
  eventType: "transaction_settled" | "transaction_failed",
  reference: string
): Promise<Set<string>> {
  const { data } = await admin
    .from("notifications")
    .select("user_id")
    .eq("event_type", eventType)
    .contains("metadata", { reference });
  return new Set((data ?? []).map((row) => row.user_id));
}

registerConsumer("NotificationRequested", {
  name: "notification-engine",
  async handle(event: DomainEvent) {
    const payload = event.payload as unknown as NotificationRequestedPayload;
    const admin = createAdminClient();
    const eventType = payload.kind === "settled" ? "transaction_settled" : "transaction_failed";
    const alreadyNotified = await notifiedUserIds(admin, eventType, payload.transaction.reference);

    if (payload.kind === "settled") {
      await notifyTransactionSettled(payload.transaction, alreadyNotified);
    } else {
      if (payload.transaction.sender_user_id && alreadyNotified.has(payload.transaction.sender_user_id)) return;
      await notifyTransactionFailed(payload.transaction, payload.errorCode ?? "UNKNOWN");
    }
  },
});
