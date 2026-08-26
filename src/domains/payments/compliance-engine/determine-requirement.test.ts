import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { determineRequirement } from "./determine-requirement";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie la lecture
 * de compliance_rules (y compris la règle réglementaire 200 000 XOF
 * insérée par supabase/migrations/0011_compliance_rules.sql) et la
 * configurabilité réelle via des règles de test temporaires, nettoyées
 * après coup. Les scénarios "aucune règle" utilisent une devise unique
 * par test pour ne jamais entrer en collision avec la règle XOF seedée.
 */
describe("Compliance Engine — determineRequirement (intégration)", () => {
  const admin = createAdminClient();
  const createdRuleIds: string[] = [];

  afterAll(async () => {
    if (createdRuleIds.length > 0) {
      await admin.from("compliance_rules").delete().in("id", createdRuleIds);
    }
  });

  it("aucune règle ne correspond ⇒ NONE (l'absence de configuration n'est jamais un refus)", async () => {
    const decision = await determineRequirement({
      amount: 1_000,
      currency: `TEST_${randomUUID().slice(0, 6)}`,
    });
    expect(decision).toEqual({ requirement: "NONE", ruleId: null, ruleType: null, description: null });
  });

  it("applique la règle réglementaire seedée (> 200 000 XOF ⇒ KYC_ENHANCED)", async () => {
    const below = await determineRequirement({ amount: 200_000, currency: "XOF" });
    expect(below.requirement).toBe("NONE");

    const above = await determineRequirement({ amount: 200_000.01, currency: "XOF" });
    expect(above.requirement).toBe("KYC_ENHANCED");
    expect(above.ruleType).toBe("REGULATORY_RULE");
    expect(above.ruleId).not.toBeNull();
  });

  it("une règle plus spécifique (pays) l'emporte sur une règle générique de même devise", async () => {
    const currency = `TEST_${randomUUID().slice(0, 6)}`;

    const generic = await admin
      .from("compliance_rules")
      .insert({
        rule_type: "CONFIGURATION",
        requirement: "KYC_STANDARD",
        currency,
        description: "Règle générique de test",
      })
      .select("id")
      .single();
    if (generic.error || !generic.data) throw new Error(`Setup échoué: ${generic.error?.message}`);
    createdRuleIds.push(generic.data.id);

    const countrySpecific = await admin
      .from("compliance_rules")
      .insert({
        rule_type: "CONFIGURATION",
        requirement: "KYC_ENHANCED",
        currency,
        country: "CI",
        description: "Règle pays de test",
      })
      .select("id")
      .single();
    if (countrySpecific.error || !countrySpecific.data) {
      throw new Error(`Setup échoué: ${countrySpecific.error?.message}`);
    }
    createdRuleIds.push(countrySpecific.data.id);

    const inCountry = await determineRequirement({ amount: 1_000, currency, country: "CI" });
    expect(inCountry.ruleId).toBe(countrySpecific.data.id);
    expect(inCountry.requirement).toBe("KYC_ENHANCED");

    const elsewhere = await determineRequirement({ amount: 1_000, currency, country: "SN" });
    expect(elsewhere.ruleId).toBe(generic.data.id);
    expect(elsewhere.requirement).toBe("KYC_STANDARD");
  });

  it("une règle MANUAL_REVIEW est renvoyée telle quelle (l'application est laissée à l'appelant)", async () => {
    const currency = `TEST_${randomUUID().slice(0, 6)}`;

    const { data: rule, error } = await admin
      .from("compliance_rules")
      .insert({
        rule_type: "PRODUCT_RULE",
        requirement: "MANUAL_REVIEW",
        currency,
        min_amount: 1_000_000,
        description: "Revue manuelle au-delà d'un seuil produit, à titre de test",
      })
      .select("id")
      .single();
    if (error || !rule) throw new Error(`Setup échoué: ${error?.message}`);
    createdRuleIds.push(rule.id);

    const decision = await determineRequirement({ amount: 2_000_000, currency });
    expect(decision).toMatchObject({
      requirement: "MANUAL_REVIEW",
      ruleId: rule.id,
      ruleType: "PRODUCT_RULE",
    });
  });
});
