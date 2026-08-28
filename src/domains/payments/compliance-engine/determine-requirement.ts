import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickMostSpecificRule } from "./match-rule";
import type { ComplianceCheckInput, ComplianceDecision } from "./types";

/**
 * Compliance Engine (Prompt 19) — détermine le niveau de vérification
 * exigé par une transaction à partir de `compliance_rules`, jamais d'une
 * règle codée en dur. Aucune règle correspondante ⇒ `NONE` : l'absence
 * de configuration n'est jamais un refus (même principe que le Limit
 * Engine, ADR-036).
 */
export async function determineRequirement(input: ComplianceCheckInput): Promise<ComplianceDecision> {
  const admin = createAdminClient();
  // `.order("created_at")` : voir le même correctif dans fee-engine/calculate-fee.ts.
  const { data, error } = await admin.from("compliance_rules").select("*").eq("active", true).order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Compliance Engine: lecture des règles échouée (${error.message})`);
  }

  const rule = pickMostSpecificRule(data ?? [], input);
  if (!rule) {
    return { requirement: "NONE", ruleId: null, ruleType: null, description: null };
  }

  return {
    requirement: rule.requirement,
    ruleId: rule.id,
    ruleType: rule.rule_type,
    description: rule.description,
  };
}
