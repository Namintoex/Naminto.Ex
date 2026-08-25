import { describe, expect, it } from "vitest";
import {
  AMOUNT_HIGH_THRESHOLD_XOF,
  AMOUNT_MEDIUM_THRESHOLD_XOF,
  BEHAVIOR_MULTIPLIER_THRESHOLD,
  EXTERNAL_CONTEXT_AMOUNT_THRESHOLD_XOF,
  FREQUENCY_HIGH_THRESHOLD,
  FREQUENCY_MEDIUM_THRESHOLD,
  NEW_BENEFICIARY_AMOUNT_THRESHOLD_XOF,
  aggregateRiskDecision,
  computeAmountSignal,
  computeBehaviorSignal,
  computeBeneficiarySignal,
  computeContextSignal,
  computeDeviceSignal,
  computeFrequencySignal,
  computeHistorySignal,
} from "./assess-risk";

describe("Risk Engine — signaux purs (Prompt 17)", () => {
  it("amount : LOW sous le seuil MEDIUM, MEDIUM entre les deux seuils, HIGH au-delà", () => {
    expect(computeAmountSignal(1_000).level).toBe("LOW");
    expect(computeAmountSignal(AMOUNT_MEDIUM_THRESHOLD_XOF + 1).level).toBe("MEDIUM");
    expect(computeAmountSignal(AMOUNT_HIGH_THRESHOLD_XOF + 1).level).toBe("HIGH");
  });

  it("frequency : LOW sous le seuil, MEDIUM puis HIGH aux seuils configurés", () => {
    expect(computeFrequencySignal(1).level).toBe("LOW");
    expect(computeFrequencySignal(FREQUENCY_MEDIUM_THRESHOLD).level).toBe("MEDIUM");
    expect(computeFrequencySignal(FREQUENCY_HIGH_THRESHOLD).level).toBe("HIGH");
  });

  it("history : MEDIUM pour un compte sans aucune transaction réglée, LOW sinon", () => {
    expect(computeHistorySignal(0).level).toBe("MEDIUM");
    expect(computeHistorySignal(1).level).toBe("LOW");
    expect(computeHistorySignal(50).level).toBe("LOW");
  });

  it("device : appareil actif LOW, révoqué/non approuvé/inconnu MEDIUM, non transmis LOW", () => {
    expect(computeDeviceSignal("active").level).toBe("LOW");
    expect(computeDeviceSignal("revoked").level).toBe("MEDIUM");
    expect(computeDeviceSignal("untrusted").level).toBe("MEDIUM");
    expect(computeDeviceSignal("unknown").level).toBe("MEDIUM");
    expect(computeDeviceSignal("unspecified").level).toBe("LOW");
  });

  it("beneficiary : nouveau bénéficiaire + montant significatif = MEDIUM, sinon LOW", () => {
    expect(computeBeneficiarySignal(true, NEW_BENEFICIARY_AMOUNT_THRESHOLD_XOF + 1).level).toBe("MEDIUM");
    expect(computeBeneficiarySignal(true, 1_000).level).toBe("LOW");
    expect(computeBeneficiarySignal(false, 1_000_000).level).toBe("LOW");
  });

  it("behavior : montant nettement supérieur à la moyenne habituelle = MEDIUM, sinon LOW", () => {
    const avg = 10_000;
    expect(computeBehaviorSignal(avg * BEHAVIOR_MULTIPLIER_THRESHOLD + 1, avg).level).toBe("MEDIUM");
    expect(computeBehaviorSignal(avg, avg).level).toBe("LOW");
    expect(computeBehaviorSignal(1_000_000, null).level).toBe("LOW");
  });

  it("context : sortie externe pour un montant élevé = MEDIUM, sinon LOW", () => {
    expect(computeContextSignal("external", EXTERNAL_CONTEXT_AMOUNT_THRESHOLD_XOF + 1).level).toBe("MEDIUM");
    expect(computeContextSignal("external", 1_000).level).toBe("LOW");
    expect(computeContextSignal("naminto_wallet", 10_000_000).level).toBe("LOW");
  });

  it("aggregateRiskDecision : le signal le plus sévère l'emporte, sans composition de plusieurs MEDIUM", () => {
    const decision = aggregateRiskDecision([
      computeAmountSignal(1_000), // LOW
      computeHistorySignal(0), // MEDIUM
      computeBeneficiarySignal(true, 1_000_000), // MEDIUM
      computeContextSignal("external", 1_000_000), // MEDIUM
    ]);
    // Trois signaux MEDIUM simultanés ne composent jamais en HIGH — voir
    // docs/DECISIONS.md ADR-045 (rôle du Fraud Engine, Prompt 18).
    expect(decision.level).toBe("MEDIUM");
    expect(decision.reasons).toHaveLength(4);
  });

  it("aggregateRiskDecision : un seul signal HIGH suffit à rendre la décision HIGH", () => {
    const decision = aggregateRiskDecision([computeAmountSignal(1_000), computeAmountSignal(AMOUNT_HIGH_THRESHOLD_XOF + 1)]);
    expect(decision.level).toBe("HIGH");
  });

  it("aggregateRiskDecision : aucun signal élevé = LOW", () => {
    const decision = aggregateRiskDecision([computeAmountSignal(100), computeHistorySignal(5)]);
    expect(decision.level).toBe("LOW");
  });
});
