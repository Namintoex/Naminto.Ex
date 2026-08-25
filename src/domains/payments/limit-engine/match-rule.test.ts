import { describe, expect, it } from "vitest";
import { pickRuleForType, ruleMatches, ruleSpecificity, type LimitRule } from "./match-rule";
import type { LimitCheckInput } from "./types";

function makeRule(overrides: Partial<LimitRule> = {}): LimitRule {
  return {
    id: "test-rule",
    limit_type: "daily_amount",
    max_amount: 500_000,
    max_count: null,
    period_hours: null,
    country: null,
    currency: null,
    kyc_status: null,
    provider: null,
    transaction_type: null,
    user_tier: null,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const baseInput: LimitCheckInput = {
  userId: "user-1",
  amount: 5_000,
  currency: "XOF",
};

describe("ruleMatches (limit engine)", () => {
  it("une règle tout-joker correspond à toute requête", () => {
    expect(ruleMatches(makeRule(), baseInput)).toBe(true);
  });

  it("rejette si kyc_status contraint diffère", () => {
    const rule = makeRule({ kyc_status: "verified" });
    expect(ruleMatches(rule, baseInput)).toBe(false);
    expect(ruleMatches(rule, { ...baseInput, kycStatus: "verified" })).toBe(true);
    expect(ruleMatches(rule, { ...baseInput, kycStatus: "unverified" })).toBe(false);
  });

  it("rejette si provider contraint diffère", () => {
    const rule = makeRule({ provider: "wave" });
    expect(ruleMatches(rule, { ...baseInput, provider: "orange" })).toBe(false);
    expect(ruleMatches(rule, { ...baseInput, provider: "wave" })).toBe(true);
  });
});

describe("ruleSpecificity (limit engine)", () => {
  it("une règle tout-joker a la spécificité la plus basse", () => {
    expect(ruleSpecificity(makeRule())).toBe(0);
  });

  it("chaque dimension contrainte augmente la spécificité", () => {
    expect(ruleSpecificity(makeRule({ currency: "XOF" }))).toBe(1);
    expect(ruleSpecificity(makeRule({ currency: "XOF", kyc_status: "verified" }))).toBe(2);
  });
});

describe("pickRuleForType", () => {
  it("filtre par limit_type avant de chercher une correspondance", () => {
    const daily = makeRule({ id: "daily", limit_type: "daily_amount", currency: "XOF" });
    const monthly = makeRule({ id: "monthly", limit_type: "monthly_amount", currency: "XOF", max_amount: 2_000_000 });

    expect(pickRuleForType([daily, monthly], "daily_amount", baseInput)?.id).toBe("daily");
    expect(pickRuleForType([daily, monthly], "monthly_amount", baseInput)?.id).toBe("monthly");
    expect(pickRuleForType([daily, monthly], "per_transaction_amount", baseInput)).toBeNull();
  });

  it("retient la règle la plus spécifique pour un même type", () => {
    const generic = makeRule({ id: "generic", limit_type: "daily_amount", currency: "XOF", max_amount: 500_000 });
    const verifiedOnly = makeRule({
      id: "verified",
      limit_type: "daily_amount",
      currency: "XOF",
      kyc_status: "verified",
      max_amount: 2_000_000,
    });

    const picked = pickRuleForType([generic, verifiedOnly], "daily_amount", {
      ...baseInput,
      kycStatus: "verified",
    });
    expect(picked?.id).toBe("verified");

    const pickedUnverified = pickRuleForType([generic, verifiedOnly], "daily_amount", {
      ...baseInput,
      kycStatus: "unverified",
    });
    expect(pickedUnverified?.id).toBe("generic");
  });

  it("ignore les règles inactives", () => {
    const inactive = makeRule({ active: false });
    expect(pickRuleForType([inactive], "daily_amount", baseInput)).toBeNull();
  });

  it("renvoie null (aucune contrainte) si aucune règle n'est configurée pour ce type", () => {
    expect(pickRuleForType([], "daily_amount", baseInput)).toBeNull();
  });
});
