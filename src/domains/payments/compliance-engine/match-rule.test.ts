import { describe, expect, it } from "vitest";
import { pickMostSpecificRule, ruleMatches, ruleSpecificity, type ComplianceRule } from "./match-rule";
import type { ComplianceCheckInput } from "./types";

function makeRule(overrides: Partial<ComplianceRule> = {}): ComplianceRule {
  return {
    id: "test-rule",
    rule_type: "REGULATORY_RULE",
    requirement: "KYC_ENHANCED",
    country: null,
    currency: null,
    min_amount: null,
    max_amount: null,
    source_type: null,
    destination_type: null,
    description: "Règle de test",
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const baseInput: ComplianceCheckInput = { amount: 5_000, currency: "XOF" };

describe("ruleMatches (compliance engine)", () => {
  it("une règle tout-joker correspond à toute requête", () => {
    expect(ruleMatches(makeRule(), baseInput)).toBe(true);
  });

  it("rejette si la devise contrainte diffère", () => {
    const rule = makeRule({ currency: "EUR" });
    expect(ruleMatches(rule, baseInput)).toBe(false);
    expect(ruleMatches(rule, { ...baseInput, currency: "EUR" })).toBe(true);
  });

  it("respecte une plage de montant (min/max)", () => {
    const rule = makeRule({ min_amount: 200_000.01 });
    expect(ruleMatches(rule, { ...baseInput, amount: 200_000 })).toBe(false);
    expect(ruleMatches(rule, { ...baseInput, amount: 200_000.01 })).toBe(true);
    expect(ruleMatches(rule, { ...baseInput, amount: 1_000_000 })).toBe(true);
  });

  it("rejette si le type de destination contraint diffère", () => {
    const rule = makeRule({ destination_type: "external" });
    expect(ruleMatches(rule, { ...baseInput, destinationType: "naminto_wallet" })).toBe(false);
    expect(ruleMatches(rule, { ...baseInput, destinationType: "external" })).toBe(true);
  });
});

describe("ruleSpecificity (compliance engine)", () => {
  it("une règle tout-joker a la spécificité la plus basse", () => {
    expect(ruleSpecificity(makeRule())).toBe(0);
  });

  it("chaque dimension contrainte augmente la spécificité, y compris une plage de montant", () => {
    expect(ruleSpecificity(makeRule({ currency: "XOF" }))).toBe(1);
    expect(ruleSpecificity(makeRule({ currency: "XOF", min_amount: 200_000 }))).toBe(2);
    expect(ruleSpecificity(makeRule({ currency: "XOF", country: "CI", destination_type: "external" }))).toBe(3);
  });
});

describe("pickMostSpecificRule (compliance engine)", () => {
  it("retient la règle la plus spécifique parmi celles qui correspondent", () => {
    const generic = makeRule({ id: "generic", currency: "XOF", min_amount: 200_000.01, requirement: "KYC_ENHANCED" });
    const countrySpecific = makeRule({
      id: "country",
      currency: "XOF",
      country: "CI",
      min_amount: 200_000.01,
      requirement: "MANUAL_REVIEW",
    });

    const picked = pickMostSpecificRule([generic, countrySpecific], {
      ...baseInput,
      amount: 250_000,
      country: "CI",
    });
    expect(picked?.id).toBe("country");

    const pickedElsewhere = pickMostSpecificRule([generic, countrySpecific], {
      ...baseInput,
      amount: 250_000,
      country: "SN",
    });
    expect(pickedElsewhere?.id).toBe("generic");
  });

  it("ignore les règles inactives", () => {
    const inactive = makeRule({ active: false });
    expect(pickMostSpecificRule([inactive], baseInput)).toBeNull();
  });

  it("renvoie null (aucune exigence) si aucune règle ne correspond", () => {
    expect(pickMostSpecificRule([], baseInput)).toBeNull();
    expect(pickMostSpecificRule([makeRule({ min_amount: 200_000.01 })], baseInput)).toBeNull();
  });
});
