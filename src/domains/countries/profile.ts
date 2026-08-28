import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CountryProfile } from "./types";

/**
 * Assemble le CountryProfile complet (Prompt 29) — country, currency,
 * providers, rails, languages, privacy déjà sur `countries` ;
 * pricing/limits/kyc-aml/legalRules agrégés depuis les moteurs de
 * règles déjà en place (Prompts 10/11/19/22), jamais recalculés ni
 * dupliqués. `legalRules` inclut les documents génériques (`country`
 * NULL, s'appliquent à tous les pays) en plus de ceux propres à ce pays.
 */
export async function getCountryProfile(code: string): Promise<CountryProfile | null> {
  const admin = createAdminClient();
  const normalized = code.trim().toUpperCase();

  const { data: country } = await admin.from("countries").select("*").eq("code", normalized).maybeSingle();
  if (!country) return null;

  const [{ data: pricing }, { data: limits }, { data: kycAml }, { data: legalRules }] = await Promise.all([
    admin.from("fee_rules").select("*").eq("country", normalized).eq("active", true),
    admin.from("limit_rules").select("*").eq("country", normalized).eq("active", true),
    admin.from("compliance_rules").select("*").eq("country", normalized).eq("active", true),
    admin.from("legal_documents").select("*").or(`country.eq.${normalized},country.is.null`).eq("published", true),
  ]);

  return {
    code: country.code,
    name: country.name,
    currency: country.currency,
    languages: country.languages,
    providers: country.providers,
    rails: country.rails,
    privacyNotes: country.privacy_notes,
    active: country.active,
    pricing: pricing ?? [],
    limits: limits ?? [],
    kycAml: kycAml ?? [],
    legalRules: legalRules ?? [],
  };
}

/**
 * Devises réellement supportées (Prompt 29) — dérivées des pays actifs,
 * jamais une liste codée en dur. Remplace `SUPPORTED_CURRENCIES = ["XOF"]`
 * qui bloquait structurellement toute autre devise dans le cœur
 * financier (orchestrator-steps/validate.ts) — voir docs/DECISIONS.md ADR-057.
 */
export async function listActiveCurrencies(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("countries").select("currency").eq("active", true);
  return [...new Set((data ?? []).map((c) => c.currency))];
}
