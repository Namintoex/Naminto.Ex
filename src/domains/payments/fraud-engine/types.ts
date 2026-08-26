import type { RiskDecision, RiskSignal } from "@/domains/payments/risk-engine";

export type FraudSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FraudAction = "ALLOW" | "STEP_UP" | "BLOCK" | "MANUAL_REVIEW";

/**
 * Tout ce dont une règle a besoin pour décider — entièrement dérivé de
 * la décision déjà produite par le Risk Engine (Prompt 17) et de la
 * requête elle-même. Aucune nouvelle lecture en base : le Fraud Engine
 * ne duplique jamais les signaux, il les recombine.
 */
export interface FraudRuleContext {
  riskDecision: RiskDecision;
  signalsByCode: Record<RiskSignal["code"], RiskSignal>;
  amount: number;
  currency: string;
}

/**
 * Une règle (Prompt 18) : ID, description, severity, condition, action
 * — exactement les six champs exigés (« audit » est produit par le
 * moteur lorsqu'une règle correspond, pas un champ statique de la
 * règle elle-même — voir evaluate-fraud.ts).
 */
export interface FraudRule {
  id: string;
  description: string;
  severity: FraudSeverity;
  condition: (context: FraudRuleContext) => boolean;
  action: FraudAction;
}

export interface FraudRuleResult {
  ruleId: string;
  description: string;
  severity: FraudSeverity;
  action: FraudAction;
}

export interface FraudDecision {
  action: FraudAction;
  /** Règles qui ont réellement matché — la trace d'audit exigée par le
   *  Prompt 18, jamais une décision opaque. Vide si `action = ALLOW` par
   *  défaut (aucune règle ne s'est déclenchée). */
  matchedRules: FraudRuleResult[];
}
