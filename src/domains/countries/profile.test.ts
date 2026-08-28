import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCountryProfile, listActiveCurrencies } from "./profile";

/**
 * Intégration réelle Supabase — vérifie que CountryProfile est un
 * agrégat lu depuis fee_rules/limit_rules/compliance_rules/legal_documents
 * (filtrés par pays), pas une nouvelle source de vérité (Prompt 29,
 * ADR-057).
 */
describe("getCountryProfile / listActiveCurrencies (intégration)", () => {
  const admin = createAdminClient();
  const code = `T${randomUUID().slice(0, 4).toUpperCase()}`;
  const currency = `T${randomUUID().slice(0, 2).toUpperCase()}`;
  let countryId: string;
  const feeRuleIds: string[] = [];
  const limitRuleIds: string[] = [];
  const complianceRuleIds: string[] = [];
  const legalDocIds: string[] = [];

  afterAll(async () => {
    if (feeRuleIds.length > 0) await admin.from("fee_rules").delete().in("id", feeRuleIds);
    if (limitRuleIds.length > 0) await admin.from("limit_rules").delete().in("id", limitRuleIds);
    if (complianceRuleIds.length > 0) await admin.from("compliance_rules").delete().in("id", complianceRuleIds);
    if (legalDocIds.length > 0) await admin.from("legal_documents").delete().in("id", legalDocIds);
    if (countryId) await admin.from("countries").delete().eq("id", countryId);
  });

  it("agrège pricing/limits/kycAml/legalRules depuis les tables de règles existantes, filtrés par pays", async () => {
    const { data: country, error: countryError } = await admin
      .from("countries")
      .insert({
        code,
        name: "Testonie",
        currency,
        languages: ["fr"],
        providers: ["orange"],
        rails: ["mobile_money"],
        privacy_notes: "Notes de confidentialité de test.",
        active: true,
      })
      .select("id")
      .single();
    expect(countryError).toBeNull();
    countryId = country!.id;

    const { data: feeRule } = await admin
      .from("fee_rules")
      .insert({ country: code, rate_percent: 1.5, flat_fee: 100, fee_payer: "sender" })
      .select("id")
      .single();
    feeRuleIds.push(feeRule!.id);

    // Règle générique (country: null) — doit apparaître dans CE profil
    // ET dans celui de n'importe quel autre pays (joker, comme
    // `ruleMatches` de chaque moteur le traite déjà). Bug trouvé en revue
    // de code : pricing/limits/kycAml ignoraient ces règles génériques,
    // contrairement à legalRules qui les gérait déjà correctement.
    const { data: globalFeeRule } = await admin
      .from("fee_rules")
      .insert({ country: null, rate_percent: 9.9, flat_fee: 9, fee_payer: "sender" })
      .select("id")
      .single();
    feeRuleIds.push(globalFeeRule!.id);

    const { data: limitRule } = await admin
      .from("limit_rules")
      .insert({ country: code, limit_type: "daily_amount", max_amount: 500_000 })
      .select("id")
      .single();
    limitRuleIds.push(limitRule!.id);

    const { data: globalLimitRule } = await admin
      .from("limit_rules")
      .insert({ country: null, limit_type: "frequency_count", max_count: 999, period_hours: 24 })
      .select("id")
      .single();
    limitRuleIds.push(globalLimitRule!.id);

    const { data: complianceRule } = await admin
      .from("compliance_rules")
      .insert({
        country: code,
        rule_type: "REGULATORY_RULE",
        requirement: "KYC_STANDARD",
        description: "Règle de test pour Testonie.",
      })
      .select("id")
      .single();
    complianceRuleIds.push(complianceRule!.id);

    const { data: globalComplianceRule } = await admin
      .from("compliance_rules")
      .insert({
        country: null,
        rule_type: "REGULATORY_RULE",
        requirement: "KYC_STANDARD",
        description: "Règle générique de test.",
      })
      .select("id")
      .single();
    complianceRuleIds.push(globalComplianceRule!.id);

    const { data: countrySpecificDoc } = await admin
      .from("legal_documents")
      .insert({
        type: "terms",
        locale: "fr",
        title: "CGU Testonie",
        content: "...",
        published: true,
        country: code,
      })
      .select("id")
      .single();
    legalDocIds.push(countrySpecificDoc!.id);

    const { data: genericDoc } = await admin
      .from("legal_documents")
      .insert({
        type: "privacy",
        locale: "fr",
        title: `Confidentialité générique ${code}`,
        content: "...",
        published: true,
        country: null,
      })
      .select("id")
      .single();
    legalDocIds.push(genericDoc!.id);

    // Document publié d'un AUTRE pays : ne doit jamais apparaître.
    const { data: otherCountryDoc } = await admin
      .from("legal_documents")
      .insert({
        type: "terms",
        locale: "fr",
        title: "CGU autre pays",
        content: "...",
        published: true,
        country: "CI",
      })
      .select("id")
      .single();
    legalDocIds.push(otherCountryDoc!.id);

    const profile = await getCountryProfile(code);
    expect(profile).toBeTruthy();
    expect(profile!.code).toBe(code);
    expect(profile!.currency).toBe(currency);
    expect(profile!.languages).toEqual(["fr"]);
    expect(profile!.providers).toEqual(["orange"]);
    expect(profile!.rails).toEqual(["mobile_money"]);
    expect(profile!.privacyNotes).toBe("Notes de confidentialité de test.");

    // Chaque liste contient à la fois la règle spécifique à ce pays ET la
    // règle générique (country: null, joker) — jamais l'une sans l'autre.
    expect(profile!.pricing.map((r) => r.id)).toEqual(expect.arrayContaining([feeRule!.id, globalFeeRule!.id]));
    expect(profile!.limits.map((r) => r.id)).toEqual(expect.arrayContaining([limitRule!.id, globalLimitRule!.id]));
    expect(profile!.kycAml.map((r) => r.id)).toEqual(
      expect.arrayContaining([complianceRule!.id, globalComplianceRule!.id])
    );

    const legalIds = profile!.legalRules.map((d) => d.id);
    expect(legalIds).toContain(countrySpecificDoc!.id);
    expect(legalIds).toContain(genericDoc!.id);
    expect(legalIds).not.toContain(otherCountryDoc!.id);

    // Insensible à la casse : un code minuscule doit être normalisé.
    const lowercaseLookup = await getCountryProfile(code.toLowerCase());
    expect(lowercaseLookup?.code).toBe(code);
  });

  it("retourne null pour un code pays inexistant", async () => {
    const profile = await getCountryProfile(`ZZ${randomUUID().slice(0, 4)}`);
    expect(profile).toBeNull();
  });

  it("listActiveCurrencies inclut la devise d'un pays actif fraîchement créé", async () => {
    const currencies = await listActiveCurrencies();
    expect(currencies).toContain(currency);
  });
});
