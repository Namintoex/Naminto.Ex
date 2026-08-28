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
 */
async function alreadyNotified(admin: AdminClient, eventType: "transaction_settled" | "transaction_failed", reference: string): Promise<boolean> {
  const { data } = await admin
    .from("notifications")
    .select("id")
    .eq("event_type", eventType)
    .contains("metadata", { reference })
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

registerConsumer("NotificationRequested", {
  name: "notification-engine",
  async handle(event: DomainEvent) {
    const payload = event.payload as unknown as NotificationRequestedPayload;
    const admin = createAdminClient();
    const eventType = payload.kind === "settled" ? "transaction_settled" : "transaction_failed";

    if (await alreadyNotified(admin, eventType, payload.transaction.reference)) return;

    if (payload.kind === "settled") {
      await notifyTransactionSettled(payload.transaction);
    } else {
      await notifyTransactionFailed(payload.transaction, payload.errorCode ?? "UNKNOWN");
    }
  },
});
