import type { FraudRule } from "./types";

/**
 * Seuil de montant au-delà duquel le signal `amount` du Risk Engine
 * n'est plus LOW — réutilisé ici pour composer des règles combinant
 * plusieurs signaux, sans redéfinir de seuil monétaire propre au Fraud
 * Engine (une seule source de vérité pour « qu'est-ce qu'un montant
 * élevé », le Risk Engine — Prompt 17).
 */
const AMOUNT_NOT_LOW = new Set(["MEDIUM", "HIGH"]);

/**
 * Architecture de règles (Prompt 18) — chaque règle est une donnée
 * autonome (id, description, severity, condition, action), évaluée par
 * un moteur générique (evaluate-fraud.ts) qui ne connaît aucune règle
 * en particulier. Ajouter une règle = ajouter un élément à ce tableau,
 * jamais modifier le moteur.
 *
 * Volontairement en code plutôt qu'en table configurable — voir
 * docs/DECISIONS.md ADR-046 (même choix que le Risk Engine, ADR-045 :
 * le Prompt 18 n'exige pas explicitement une configuration en base,
 * contrairement au Fee Engine et au Limit Engine).
 */
export const FRAUD_RULES: FraudRule[] = [
  {
    id: "FRAUD-001",
    description:
      "Plusieurs opérations rapprochées portant chacune un montant non négligeable — motif classique d'un compte compromis effectuant plusieurs virements rapides avant d'être bloqué.",
    severity: "CRITICAL",
    action: "BLOCK",
    // Volontairement MEDIUM, pas HIGH : une fréquence HIGH fait déjà
    // basculer riskDecision.level à HIGH, auquel cas l'orchestrateur
    // rejette directement en RISK_REJECTION avant même d'appeler le
    // Fraud Engine (voir orchestrator.ts) — cette règle ne serait donc
    // jamais atteignable si elle dupliquait cette même condition. Voir
    // docs/DECISIONS.md ADR-046.
    condition: (ctx) =>
      ctx.signalsByCode.frequency.level === "MEDIUM" && AMOUNT_NOT_LOW.has(ctx.signalsByCode.amount.level),
  },
  {
    id: "FRAUD-002",
    description:
      "Plusieurs signaux de risque modérés se combinent (historique, bénéficiaire, comportement, contexte…) — aucun n'est bloquant seul, mais leur combinaison justifie une revue avant exécution.",
    severity: "HIGH",
    action: "MANUAL_REVIEW",
    condition: (ctx) => ctx.riskDecision.reasons.filter((r) => r.level === "MEDIUM").length >= 3,
  },
  {
    id: "FRAUD-003",
    description: "Appareil non reconnu ou non approuvé combiné à un montant qui n'est pas négligeable.",
    severity: "MEDIUM",
    action: "STEP_UP",
    condition: (ctx) =>
      ctx.signalsByCode.device.level === "MEDIUM" && AMOUNT_NOT_LOW.has(ctx.signalsByCode.amount.level),
  },
  {
    id: "FRAUD-004",
    description: "Nouveau bénéficiaire externe pour un montant élevé — première opération de ce type.",
    severity: "MEDIUM",
    action: "STEP_UP",
    condition: (ctx) => ctx.signalsByCode.beneficiary.level === "MEDIUM" && ctx.signalsByCode.context.level === "MEDIUM",
  },
];
