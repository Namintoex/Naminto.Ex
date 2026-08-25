import type {
  DestinationType,
  Provider,
  SourceType,
} from "@/lib/supabase/database.types";

export interface PaymentRequest {
  senderUserId: string;
  recipientUserId: string | null;
  sourceType: SourceType;
  /** Requis si sourceType = 'linked_account'. */
  sourceLinkedAccountId: string | null;
  destinationType: DestinationType;
  /** Requis si destinationType = 'linked_account'. */
  destinationLinkedAccountId: string | null;
  amount: number;
  currency: string;
  /** PIN Naminto.Ex en clair, jamais journalisé ni persisté tel quel. */
  pin: string;
  /** Empêche toute double exécution en cas de rejeu (Master Prompt, section 6). */
  idempotencyKey: string;
}

export interface ResolvedRoute {
  provider: Provider | null;
  linkedAccountId: string | null;
  externalReference: string | null;
}
