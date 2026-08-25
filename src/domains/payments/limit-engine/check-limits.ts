import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickRuleForType } from "./match-rule";
import { getAmountUsage, getFrequencyUsage } from "./usage-queries";
import type { LimitCheckInput, LimitDecision, LimitViolation } from "./types";

/**
 * Limit Engine (Prompt 11). Domaine indépendant, entièrement piloté par
 * la configuration en base (`limit_rules`). S'exécute exclusivement
 * côté serveur (Payment Orchestrator) — jamais de blocage côté frontend
 * uniquement, conformément à l'exigence explicite du prompt.
 *
 * Absence de règle configurée pour un type de limite = aucune contrainte
 * sur ce type, jamais un refus (aucune valeur de limite n'est
 * documentée dans les sources du projet — voir docs/DECISIONS.md).
 */
export async function checkLimits(input: LimitCheckInput): Promise<LimitDecision> {
  const admin = createAdminClient();

  let kycStatus = input.kycStatus;
  if (kycStatus === undefined) {
    const { data: profile } = await admin
      .from("identity_profiles")
      .select("kyc_status")
      .eq("user_id", input.userId)
      .maybeSingle();
    kycStatus = profile?.kyc_status ?? null;
  }
  const resolvedInput: LimitCheckInput = { ...input, kycStatus };

  const { data: rules, error } = await admin.from("limit_rules").select("*").eq("active", true);
  if (error) {
    throw new Error(`Limit Engine: lecture des règles échouée (${error.message})`);
  }

  const violations: LimitViolation[] = [];

  const perTransactionRule = pickRuleForType(rules ?? [], "per_transaction_amount", resolvedInput);
  if (perTransactionRule && perTransactionRule.max_amount !== null && input.amount > perTransactionRule.max_amount) {
    violations.push({
      ruleId: perTransactionRule.id,
      limitType: "per_transaction_amount",
      limitValue: perTransactionRule.max_amount,
      projectedUsage: input.amount,
      message: `Montant (${input.amount}) supérieur à la limite par transaction (${perTransactionRule.max_amount}).`,
    });
  }

  const dailyRule = pickRuleForType(rules ?? [], "daily_amount", resolvedInput);
  if (dailyRule && dailyRule.max_amount !== null) {
    const used = await getAmountUsage(input.userId, input.currency, "day");
    const projected = used + input.amount;
    if (projected > dailyRule.max_amount) {
      violations.push({
        ruleId: dailyRule.id,
        limitType: "daily_amount",
        limitValue: dailyRule.max_amount,
        projectedUsage: projected,
        message: `Cumul journalier projeté (${projected}) supérieur à la limite (${dailyRule.max_amount}).`,
      });
    }
  }

  const monthlyRule = pickRuleForType(rules ?? [], "monthly_amount", resolvedInput);
  if (monthlyRule && monthlyRule.max_amount !== null) {
    const used = await getAmountUsage(input.userId, input.currency, "month");
    const projected = used + input.amount;
    if (projected > monthlyRule.max_amount) {
      violations.push({
        ruleId: monthlyRule.id,
        limitType: "monthly_amount",
        limitValue: monthlyRule.max_amount,
        projectedUsage: projected,
        message: `Cumul mensuel projeté (${projected}) supérieur à la limite (${monthlyRule.max_amount}).`,
      });
    }
  }

  const frequencyRule = pickRuleForType(rules ?? [], "frequency_count", resolvedInput);
  if (frequencyRule && frequencyRule.max_count !== null && frequencyRule.period_hours !== null) {
    const used = await getFrequencyUsage(input.userId, frequencyRule.period_hours);
    const projected = used + 1;
    if (projected > frequencyRule.max_count) {
      violations.push({
        ruleId: frequencyRule.id,
        limitType: "frequency_count",
        limitValue: frequencyRule.max_count,
        projectedUsage: projected,
        message: `Nombre d'opérations projeté (${projected}) sur ${frequencyRule.period_hours}h supérieur à la limite (${frequencyRule.max_count}).`,
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}
