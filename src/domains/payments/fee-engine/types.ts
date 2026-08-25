import type {
  DestinationType,
  FeePayer,
  FeeTransactionType,
  Provider,
  SourceType,
} from "@/lib/supabase/database.types";

export type { FeePayer, FeeTransactionType };

/**
 * Entrée du Fee Engine (Prompt 10). Chaque champ optionnel correspond à
 * une dimension sur laquelle une règle peut se spécialiser — `undefined`/
 * absent signifie « inconnu pour cette requête », traité exactement comme
 * un joker côté correspondance de règle.
 */
export interface FeeCalculationInput {
  amount: number;
  currency: string;
  country?: string | null;
  sourceType?: SourceType | null;
  destinationType?: DestinationType | null;
  provider?: Provider | null;
  transactionType?: FeeTransactionType | null;
  userTier?: string | null;
  /** Préférence explicite de l'utilisateur — prioritaire sur le
   *  fee_payer par défaut de la règle retenue (architecture générale,
   *  section 28 : « Qui paie les frais ? »). */
  feePayerOverride?: FeePayer;
}

export interface FeeCalculationResult {
  fee: number;
  senderDebit: number;
  recipientCredit: number;
  feePayer: FeePayer;
  ruleId: string;
}

export class NoMatchingFeeRuleError extends Error {
  constructor(input: FeeCalculationInput) {
    super(`Aucune règle de frais active ne correspond à la requête (devise: ${input.currency})`);
    this.name = "NoMatchingFeeRuleError";
  }
}
