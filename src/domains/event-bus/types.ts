import type { Database, DomainEventType, EventDeliveryOutcome, EventDeliveryStatus } from "@/lib/supabase/database.types";

export type { DomainEventType, EventDeliveryStatus, EventDeliveryOutcome };

export const DOMAIN_EVENT_TYPES: DomainEventType[] = [
  "TransactionCreated",
  "TransactionValidated",
  "TransactionAuthenticated",
  "TransactionProcessing",
  "ProviderConfirmed",
  "TransactionSettled",
  "TransactionFailed",
  "TransactionReversed",
  "TransactionRefunded",
  "RiskDecisionMade",
  "KYCStatusChanged",
  "NotificationRequested",
];

export type DomainEventRow = Database["public"]["Tables"]["domain_events"]["Row"];
export type EventDeliveryRow = Database["public"]["Tables"]["event_deliveries"]["Row"];

/** Forme reçue par un consumer — jamais la ligne brute en base (découplage). */
export interface DomainEvent<P = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  correlationId: string;
  payload: P;
  occurredAt: string;
  createdAt: string;
}

/**
 * Contrat d'un consumer (Prompt 26) — `handle` DOIT être idempotent :
 * un rejeu de livraison (retry) ne doit jamais produire un effet de bord
 * dupliqué. L'infrastructure (unique(event_id, consumer)) garantit qu'un
 * consumer n'est jamais enregistré deux fois pour le même événement,
 * mais ne peut pas garantir à elle seule qu'un *retry* d'une même
 * livraison reste sans effet — cette garantie reste la responsabilité
 * de chaque `handle`.
 */
export interface EventConsumer {
  name: string;
  handle: (event: DomainEvent) => Promise<void>;
}
