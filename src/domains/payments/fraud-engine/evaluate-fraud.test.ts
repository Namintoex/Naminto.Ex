import { describe, expect, it } from "vitest";
import { buildFraudContext, evaluateFraud } from "./evaluate-fraud";
import type { RiskDecision, RiskSignal } from "@/domains/payments/risk-engine";

function riskSignal(code: RiskSignal["code"], level: RiskSignal["level"]): RiskSignal {
  return { code, level, reason: `${code}:${level}` };
}

function riskDecision(signals: RiskSignal[]): RiskDecision {
  let level: RiskSignal["level"] = "LOW";
  for (const s of signals) {
    if (s.level === "HIGH") level = "HIGH";
    else if (s.level === "MEDIUM" && level !== "HIGH") level = "MEDIUM";
  }
  return { level, reasons: signals };
}

const ALL_LOW: RiskSignal[] = [
  riskSignal("amount", "LOW"),
  riskSignal("frequency", "LOW"),
  riskSignal("history", "LOW"),
  riskSignal("device", "LOW"),
  riskSignal("beneficiary", "LOW"),
  riskSignal("behavior", "LOW"),
  riskSignal("context", "LOW"),
];

function withOverrides(overrides: Partial<Record<RiskSignal["code"], RiskSignal["level"]>>): RiskSignal[] {
  return ALL_LOW.map((s) => {
    const overrideLevel = overrides[s.code];
    return overrideLevel ? { ...s, level: overrideLevel } : s;
  });
}

describe("Fraud Engine — evaluateFraud (Prompt 18)", () => {
  it("aucune règle déclenchée ⇒ ALLOW sans trace d'audit", () => {
    const decision = evaluateFraud(buildFraudContext(riskDecision(ALL_LOW), 1_000, "XOF"));
    expect(decision.action).toBe("ALLOW");
    expect(decision.matchedRules).toHaveLength(0);
  });

  it("FRAUD-001 : fréquence modérée + montant non négligeable ⇒ BLOCK, avec trace d'audit explicable", () => {
    const signals = withOverrides({ frequency: "MEDIUM", amount: "MEDIUM" });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 150_000, "XOF"));
    expect(decision.action).toBe("BLOCK");
    expect(decision.matchedRules.map((r) => r.ruleId)).toContain("FRAUD-001");
    expect(decision.matchedRules[0].description.length).toBeGreaterThan(0);
  });

  it("FRAUD-001 ne se déclenche pas pour une fréquence modérée seule (montant négligeable)", () => {
    const signals = withOverrides({ frequency: "MEDIUM" });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 500, "XOF"));
    expect(decision.matchedRules.map((r) => r.ruleId)).not.toContain("FRAUD-001");
  });

  it("FRAUD-002 : trois signaux MEDIUM simultanés ⇒ MANUAL_REVIEW (jamais géré par le Risk Engine lui-même)", () => {
    const signals = withOverrides({ history: "MEDIUM", beneficiary: "MEDIUM", context: "MEDIUM" });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 250_000, "XOF"));
    expect(decision.action).toBe("MANUAL_REVIEW");
    expect(decision.matchedRules.map((r) => r.ruleId)).toContain("FRAUD-002");
  });

  it("FRAUD-003 : appareil non reconnu + montant non négligeable ⇒ STEP_UP", () => {
    const signals = withOverrides({ device: "MEDIUM", amount: "MEDIUM" });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 150_000, "XOF"));
    expect(decision.action).toBe("STEP_UP");
    expect(decision.matchedRules.map((r) => r.ruleId)).toContain("FRAUD-003");
  });

  it("FRAUD-003 ne se déclenche pas si l'appareil est connu, même pour un montant élevé", () => {
    const signals = withOverrides({ amount: "MEDIUM" });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 150_000, "XOF"));
    expect(decision.matchedRules.map((r) => r.ruleId)).not.toContain("FRAUD-003");
  });

  it("FRAUD-004 : nouveau bénéficiaire externe pour un montant élevé ⇒ STEP_UP", () => {
    const signals = withOverrides({ beneficiary: "MEDIUM", context: "MEDIUM" });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 250_000, "XOF"));
    expect(decision.action).toBe("STEP_UP");
    expect(decision.matchedRules.map((r) => r.ruleId)).toContain("FRAUD-004");
  });

  it("l'action la plus restrictive l'emporte quand plusieurs règles se déclenchent (BLOCK > MANUAL_REVIEW > STEP_UP)", () => {
    const signals = withOverrides({
      frequency: "MEDIUM",
      amount: "MEDIUM", // FRAUD-001 -> BLOCK
      history: "MEDIUM",
      beneficiary: "MEDIUM",
      context: "MEDIUM", // FRAUD-002 -> MANUAL_REVIEW, FRAUD-004 -> STEP_UP
    });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 150_000, "XOF"));
    expect(decision.action).toBe("BLOCK");
    expect(decision.matchedRules.length).toBeGreaterThanOrEqual(2);
  });

  it("chaque règle déclenchée porte un id, une severity et une action — jamais une décision opaque", () => {
    const signals = withOverrides({ frequency: "MEDIUM", amount: "MEDIUM" });
    const decision = evaluateFraud(buildFraudContext(riskDecision(signals), 150_000, "XOF"));
    for (const rule of decision.matchedRules) {
      expect(rule.ruleId).toMatch(/^FRAUD-\d{3}$/);
      expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(rule.severity);
      expect(["ALLOW", "STEP_UP", "BLOCK", "MANUAL_REVIEW"]).toContain(rule.action);
    }
  });
});
