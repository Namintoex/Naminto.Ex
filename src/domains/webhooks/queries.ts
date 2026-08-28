import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Provider } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Idempotence (Prompt 25) : un événement déjà traité avec succès ne doit
 * jamais être retraité — vrai aussi bien à la première réception qu'à un
 * rejeu contrôlé ultérieur du même event_id (replay.ts), qui doit alors
 * rester un no-op sûr (status "duplicate").
 */
export async function findExistingProcessedEvent(
  admin: AdminClient,
  provider: Provider,
  eventId: string
): Promise<boolean> {
  const { data } = await admin
    .from("webhook_events")
    .select("id")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .eq("status", "processed")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Détection hors-ordre (Prompt 25) : un événement plus ancien que le dernier déjà traité pour la même transaction fournisseur. */
export async function isOutOfOrder(
  admin: AdminClient,
  provider: Provider,
  providerTransactionId: string | null,
  occurredAt: string | null
): Promise<boolean> {
  if (!providerTransactionId || !occurredAt) return false;
  const { data: lastProcessed } = await admin
    .from("webhook_events")
    .select("occurred_at")
    .eq("provider", provider)
    .eq("provider_transaction_id", providerTransactionId)
    .eq("status", "processed")
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastProcessed?.occurred_at) return false;
  return new Date(lastProcessed.occurred_at).getTime() > new Date(occurredAt).getTime();
}

/** Corrélation best-effort vers la transaction Naminto.Ex — jamais garantie (ex. webhook orphelin, transaction pas encore créée). */
export async function resolveTransactionId(
  admin: AdminClient,
  provider: Provider,
  providerTransactionId: string | null
): Promise<string | null> {
  if (!providerTransactionId) return null;
  const { data } = await admin
    .from("transactions")
    .select("id")
    .eq("provider", provider)
    .eq("provider_transaction_id", providerTransactionId)
    .maybeSingle();
  return data?.id ?? null;
}
