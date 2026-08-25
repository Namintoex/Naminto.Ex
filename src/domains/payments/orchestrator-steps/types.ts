import type {
  DestinationType,
  FeePayer,
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
  /** Requis si destinationType = 'external' — référence du bénéficiaire
   *  externe (ex. numéro de téléphone), distincte des comptes liés du
   *  destinataire (dont Naminto.Ex ne peut rien savoir). */
  destinationExternalReference: string | null;
  amount: number;
  currency: string;
  /** Choix explicite « qui paie les frais ? » (Send Money, Prompt 13) —
   *  prioritaire sur le fee_payer par défaut de la règle retenue. */
  feePayerOverride?: FeePayer;
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
