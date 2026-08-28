import type { Database } from "@/lib/supabase/database.types";

export type CountryRow = Database["public"]["Tables"]["countries"]["Row"];
export type FeeRuleRow = Database["public"]["Tables"]["fee_rules"]["Row"];
export type LimitRuleRow = Database["public"]["Tables"]["limit_rules"]["Row"];
export type ComplianceRuleRow = Database["public"]["Tables"]["compliance_rules"]["Row"];
export type LegalDocumentRow = Database["public"]["Tables"]["legal_documents"]["Row"];

/**
 * Agrégat CountryProfile (Prompt 29) — jamais une nouvelle source de
 * vérité : `pricing`/`limits` proviennent de `fee_rules`/`limit_rules`
 * (Prompts 10/11, déjà filtrables par `country`), `kyc`/`aml` de
 * `compliance_rules` (Prompt 19, idem), `legalRules` de
 * `legal_documents` (Prompt 22 + colonne `country` ajoutée ici). Seuls
 * `currency`/`providers`/`rails`/`languages`/`privacyNotes` sont des
 * données propres à `countries` elle-même.
 */
export interface CountryProfile {
  code: string;
  name: string;
  currency: string;
  languages: string[];
  providers: string[];
  rails: string[];
  privacyNotes: string | null;
  active: boolean;
  pricing: FeeRuleRow[];
  limits: LimitRuleRow[];
  kycAml: ComplianceRuleRow[];
  legalRules: LegalDocumentRow[];
}
