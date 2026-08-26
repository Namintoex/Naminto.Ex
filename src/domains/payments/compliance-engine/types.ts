import type {
  ComplianceRequirement,
  ComplianceRuleType,
  DestinationType,
  SourceType,
} from "@/lib/supabase/database.types";

export type { ComplianceRequirement, ComplianceRuleType };

export interface ComplianceCheckInput {
  amount: number;
  currency: string;
  country?: string | null;
  sourceType?: SourceType | null;
  destinationType?: DestinationType | null;
}

/**
 * Décision du Compliance Engine (Prompt 19) — jamais un simple booléen :
 * porte le niveau exigé et la règle qui l'a déterminé, pour rester
 * auditable (exigence explicite du prompt).
 */
export interface ComplianceDecision {
  requirement: ComplianceRequirement;
  ruleId: string | null;
  ruleType: ComplianceRuleType | null;
  description: string | null;
}
