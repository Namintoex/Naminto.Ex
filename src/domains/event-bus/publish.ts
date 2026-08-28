import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DomainEventType } from "@/lib/supabase/database.types";
import { dispatchDeliveriesForEvent } from "./dispatch";
import { consumersFor } from "./registry";

/**
 * Publie un événement métier (Prompt 26) — n'échoue jamais, quelle que
 * soit la cause (écriture en base, dispatch immédiat) : l'architecture
 * événementielle reste un canal d'audit/traçage et de découplage, elle
 * ne doit jamais devenir un nouveau point de défaillance pour
 * l'opération financière qui la déclenche (même garantie que
 * notifyTransactionSettled, Prompt 20). Une défaillance est journalisée
 * en console, jamais silencieusement perdue au niveau code — l'écriture
 * elle-même dans `domain_events`, si elle réussit, reste la source de
 * vérité durable.
 *
 * `correlationId` n'est jamais généré ici : l'appelant fournit toujours
 * l'identifiant de l'entité concernée (id de transaction pour le cycle
 * de vie transactionnel, id utilisateur pour KYCStatusChanged) — jamais
 * un identifiant arbitraire inventé pour l'occasion.
 */
export async function publishEvent(
  type: DomainEventType,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<string | null> {
  try {
    const admin = createAdminClient();

    const { data: event, error } = await admin
      .from("domain_events")
      .insert({ type, correlation_id: correlationId, payload })
      .select("*")
      .single();
    if (error || !event) {
      console.error("[event-bus] publishEvent: écriture échouée", type, error);
      return null;
    }

    const consumers = consumersFor(type);
    if (consumers.length > 0) {
      await admin
        .from("event_deliveries")
        .upsert(
          consumers.map((c) => ({ event_id: event.id, consumer: c.name })),
          { onConflict: "event_id,consumer", ignoreDuplicates: true }
        );
      await dispatchDeliveriesForEvent(admin, event.id);
    }

    return event.id;
  } catch (err) {
    console.error("[event-bus] publishEvent a échoué", type, err);
    return null;
  }
}
