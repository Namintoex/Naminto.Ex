import type {
  FeeTransactionType,
  KycStatus,
  LimitType,
  Provider,
} from "@/lib/supabase/database.types";

export interface LimitCheckInput {
  userId: string;
  amount: number;
  currency: string;
  country?: string | null;
  provider?: Provider | null;
  transactionType?: FeeTransactionType | null;
  /** Résolu automatiquement depuis identity_profiles si non fourni. */
  kycStatus?: KycStatus | null;
  userTier?: string | null;
}

export interface LimitViolation {
  ruleId: string;
  limitType: LimitType;
  /** Plafond configuré (montant ou nombre selon limitType). */
  limitValue: number;
  /** Ce que deviendrait l'usage si l'opération était acceptée. */
  projectedUsage: number;
  message: string;
}

export interface LimitDecision {
  allowed: boolean;
  /** Décision explicable (Prompt 11) : le détail de chaque limite
   *  dépassée, jamais un simple booléen opaque. */
  violations: LimitViolation[];
}
