import "server-only";
import { fetchRiskContext, type ResolvedDeviceStatus } from "./usage-queries";
import type { DestinationType } from "@/lib/supabase/database.types";
import type { RiskCheckInput, RiskDecision, RiskLevel, RiskSignal, RiskSignalCode } from "./types";

/**
 * Seuils du Risk Engine (Prompt 17) — constantes de code, pas de table
 * de configuration. Contrairement au Fee Engine (Prompt 10) et au Limit
 * Engine (Prompt 11), dont l'énoncé exige explicitement des règles
 * configurables, le Prompt 17 ne le demande pas — voir
 * docs/DECISIONS.md ADR-045. Valeurs choisies par implémentation,
 * distinctes du seuil KYC de Compliance (200 000 XOF, Prompt 09) :
 * Risk et Compliance sont des moteurs séparés (« Risk ≠ Ledger » et,
 * par le même principe, Risk ≠ Compliance).
 */
export const AMOUNT_HIGH_THRESHOLD_XOF = 500_000;
export const AMOUNT_MEDIUM_THRESHOLD_XOF = 100_000;
/** Fenêtre glissante d'une heure — voir computeFrequencySignal. */
export const FREQUENCY_HIGH_THRESHOLD = 15;
export const FREQUENCY_MEDIUM_THRESHOLD = 5;
export const NEW_BENEFICIARY_AMOUNT_THRESHOLD_XOF = 50_000;
export const BEHAVIOR_MULTIPLIER_THRESHOLD = 3;
export const EXTERNAL_CONTEXT_AMOUNT_THRESHOLD_XOF = 200_000;

function signal(code: RiskSignalCode, level: RiskLevel, reason: string, details?: Record<string, unknown>): RiskSignal {
  return { code, level, reason, details };
}

export function computeAmountSignal(amount: number): RiskSignal {
  if (amount > AMOUNT_HIGH_THRESHOLD_XOF) {
    return signal("amount", "HIGH", `Montant très élevé (> ${AMOUNT_HIGH_THRESHOLD_XOF.toLocaleString("fr-FR")} XOF)`, {
      amount,
    });
  }
  if (amount > AMOUNT_MEDIUM_THRESHOLD_XOF) {
    return signal("amount", "MEDIUM", `Montant élevé (> ${AMOUNT_MEDIUM_THRESHOLD_XOF.toLocaleString("fr-FR")} XOF)`, {
      amount,
    });
  }
  return signal("amount", "LOW", "Montant dans la norme", { amount });
}

export function computeFrequencySignal(countLastHour: number): RiskSignal {
  if (countLastHour >= FREQUENCY_HIGH_THRESHOLD) {
    return signal("frequency", "HIGH", `${countLastHour} opérations dans la dernière heure`, { countLastHour });
  }
  if (countLastHour >= FREQUENCY_MEDIUM_THRESHOLD) {
    return signal("frequency", "MEDIUM", `${countLastHour} opérations dans la dernière heure`, { countLastHour });
  }
  return signal("frequency", "LOW", "Fréquence normale", { countLastHour });
}

export function computeHistorySignal(historyCount: number): RiskSignal {
  if (historyCount === 0) {
    return signal("history", "MEDIUM", "Aucune transaction réglée antérieure (compte sans historique)", {
      historyCount,
    });
  }
  return signal("history", "LOW", `${historyCount} transaction(s) réglée(s) antérieure(s)`, { historyCount });
}

export function computeDeviceSignal(deviceStatus: ResolvedDeviceStatus): RiskSignal {
  if (deviceStatus === "revoked") {
    return signal("device", "MEDIUM", "Appareil révoqué", { deviceStatus });
  }
  if (deviceStatus === "untrusted") {
    return signal("device", "MEDIUM", "Appareil non approuvé", { deviceStatus });
  }
  if (deviceStatus === "unknown") {
    return signal("device", "MEDIUM", "Appareil non reconnu pour ce compte", { deviceStatus });
  }
  if (deviceStatus === "unspecified") {
    return signal("device", "LOW", "Appareil non transmis à l'évaluation du risque", { deviceStatus });
  }
  return signal("device", "LOW", "Appareil connu et actif", { deviceStatus });
}

export function computeBeneficiarySignal(isNewBeneficiary: boolean, amount: number): RiskSignal {
  if (isNewBeneficiary && amount > NEW_BENEFICIARY_AMOUNT_THRESHOLD_XOF) {
    return signal(
      "beneficiary",
      "MEDIUM",
      `Nouveau bénéficiaire pour un montant significatif (> ${NEW_BENEFICIARY_AMOUNT_THRESHOLD_XOF.toLocaleString("fr-FR")} XOF)`,
      { isNewBeneficiary, amount }
    );
  }
  return signal(
    "beneficiary",
    "LOW",
    isNewBeneficiary ? "Nouveau bénéficiaire, montant modéré" : "Bénéficiaire déjà réglé auparavant",
    { isNewBeneficiary, amount }
  );
}

export function computeBehaviorSignal(amount: number, historyAverageAmount: number | null): RiskSignal {
  if (
    historyAverageAmount !== null &&
    historyAverageAmount > 0 &&
    amount > historyAverageAmount * BEHAVIOR_MULTIPLIER_THRESHOLD
  ) {
    const multiplier = Math.round((amount / historyAverageAmount) * 10) / 10;
    return signal("behavior", "MEDIUM", `Montant ${multiplier}x supérieur à la moyenne habituelle de l'utilisateur`, {
      amount,
      historyAverageAmount,
      multiplier,
    });
  }
  return signal("behavior", "LOW", "Cohérent avec le comportement habituel", { amount, historyAverageAmount });
}

export function computeContextSignal(destinationType: DestinationType, amount: number): RiskSignal {
  if (destinationType === "external" && amount > EXTERNAL_CONTEXT_AMOUNT_THRESHOLD_XOF) {
    return signal(
      "context",
      "MEDIUM",
      `Sortie vers un bénéficiaire externe pour un montant élevé (> ${EXTERNAL_CONTEXT_AMOUNT_THRESHOLD_XOF.toLocaleString("fr-FR")} XOF)`,
      { destinationType, amount }
    );
  }
  return signal("context", "LOW", "Contexte de la transaction sans particularité", { destinationType, amount });
}

const LEVEL_RANK: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/**
 * Agrège les signaux indépendants en une décision unique : le signal le
 * plus sévère l'emporte, jamais un score numérique opaque qui mélangerait
 * des préoccupations de nature différente. Volontairement pas de règle
 * de composition (« N signaux MEDIUM simultanés = HIGH ») — combiner
 * plusieurs signaux modérés en une décision de blocage/step-up/revue
 * manuelle est le rôle du Fraud Engine (Prompt 18, architecture de
 * règles dédiée), pas du Risk Engine lui-même. Voir docs/DECISIONS.md
 * ADR-045.
 */
export function aggregateRiskDecision(signals: RiskSignal[]): RiskDecision {
  let level: RiskLevel = "LOW";
  for (const s of signals) {
    if (LEVEL_RANK[s.level] > LEVEL_RANK[level]) level = s.level;
  }
  return { level, reasons: signals };
}

/**
 * Risk Engine (Prompt 17). Analyse amount, frequency, history, device,
 * beneficiary, behavior, context — sept signaux indépendants, chacun
 * testable séparément — puis fournit une décision structurée au Payment
 * Orchestrator. N'écrit jamais dans le Ledger, ni nulle part ailleurs :
 * lecture seule, aucun effet de bord.
 */
export async function assessRisk(input: RiskCheckInput): Promise<RiskDecision> {
  const context = await fetchRiskContext(input);

  const signals: RiskSignal[] = [
    computeAmountSignal(input.amount),
    computeFrequencySignal(context.frequencyLastHour),
    computeHistorySignal(context.historyCount),
    computeDeviceSignal(context.deviceStatus),
    computeBeneficiarySignal(context.isNewBeneficiary, input.amount),
    computeBehaviorSignal(input.amount, context.historyAverageAmount),
    computeContextSignal(input.destinationType, input.amount),
  ];

  return aggregateRiskDecision(signals);
}
