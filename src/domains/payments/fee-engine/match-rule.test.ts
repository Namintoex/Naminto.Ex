import { describe, expect, it } from "vitest";
import { pickMostSpecificRule, ruleMatches, ruleSpecificity, type FeeRule } from "./match-rule";
import type { FeeCalculationInput } from "./types";

function makeRule(overrides: Partial<FeeRule> = {}): FeeRule {
  return {
    id: "test-rule",
    country: null,
    currency: null,
    min_amount: null,
    max_amount: null,
    source_type: null,
    destination_type: null,
    provider: null,
    transaction_type: null,
    user_tier: null,
    rate_percent: 0.035,
    flat_fee: 0,
    fee_payer: "sender",
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const baseInput: FeeCalculationInput = {
  amount: 5_000,
  currency: "XOF",
};

describe("ruleMatches", () => {
  it("une règle entièrement jokers correspond à toute requête", () => {
    expect(ruleMatches(makeRule(), baseInput)).toBe(true);
  });

  it("rejette si une dimension contrainte diffère", () => {
    expect(ruleMatches(makeRule({ currency: "EUR" }), baseInput)).toBe(false);
    expect(ruleMatches(makeRule({ provider: "orange" }), { ...baseInput, provider: "mtn" })).toBe(false);
  });

  it("respecte les bornes de montant (min/max inclusifs)", () => {
    const rule = makeRule({ min_amount: 1_000, max_amount: 10_000 });
    expect(ruleMatches(rule, { ...baseInput, amount: 999 })).toBe(false);
    expect(ruleMatches(rule, { ...baseInput, amount: 1_000 })).toBe(true);
    expect(ruleMatches(rule, { ...baseInput, amount: 10_000 })).toBe(true);
    expect(ruleMatches(rule, { ...baseInput, amount: 10_001 })).toBe(false);
  });

  it("un champ non renseigné dans la requête ne correspond qu'à une règle joker sur cette dimension", () => {
    const rule = makeRule({ provider: "wave" });
    expect(ruleMatches(rule, baseInput)).toBe(false); // provider absent de la requête
    expect(ruleMatches(rule, { ...baseInput, provider: "wave" })).toBe(true);
  });
});

describe("ruleSpecificity", () => {
  it("une règle tout-joker a la spécificité la plus basse", () => {
    expect(ruleSpecificity(makeRule())).toBe(0);
  });

  it("chaque dimension contrainte augmente la spécificité", () => {
    expect(ruleSpecificity(makeRule({ currency: "XOF" }))).toBe(1);
    expect(ruleSpecificity(makeRule({ currency: "XOF", provider: "orange" }))).toBe(2);
  });

  it("une plage de montant (min et/ou max) compte pour un seul point de spécificité", () => {
    expect(ruleSpecificity(makeRule({ min_amount: 1_000 }))).toBe(1);
    expect(ruleSpecificity(makeRule({ min_amount: 1_000, max_amount: 10_000 }))).toBe(1);
  });
});

describe("pickMostSpecificRule", () => {
  it("retient la règle la plus spécifique parmi celles qui correspondent", () => {
    const generic = makeRule({ id: "generic", currency: "XOF", rate_percent: 0.035 });
    const specific = makeRule({ id: "wave-specific", currency: "XOF", provider: "wave", rate_percent: 0.02 });

    const picked = pickMostSpecificRule([generic, specific], { ...baseInput, provider: "wave" });
    expect(picked?.id).toBe("wave-specific");

    const pickedOther = pickMostSpecificRule([generic, specific], { ...baseInput, provider: "orange" });
    expect(pickedOther?.id).toBe("generic");
  });

  it("ignore les règles inactives", () => {
    const inactive = makeRule({ id: "inactive", currency: "XOF", active: false });
    expect(pickMostSpecificRule([inactive], baseInput)).toBeNull();
  });

  it("renvoie null si aucune règle ne correspond", () => {
    const rule = makeRule({ currency: "EUR" });
    expect(pickMostSpecificRule([rule], baseInput)).toBeNull();
  });
});
