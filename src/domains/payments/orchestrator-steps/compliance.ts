import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/domains/identity/security-events";
import { determineRequirement } from "@/domains/payments/compliance-engine";
import type { ComplianceDecision } from "@/domains/payments/compliance-engine";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest } from "./types";

export type { ComplianceDecision };

/**
 * Étape 4 — Compliance (Prompt 19). Délègue entièrement au Compliance
 * Engine pour déterminer le niveau de vérification exigé — aucune règle
 * codée en dur ici. Cette étape se contente d'appliquer la décision :
 * journalise systématiquement toute exigence non `NONE` (auditabilité
 * exigée par le prompt), puis vérifie que le profil de l'expéditeur la
 * satisfait.
 */
export async function checkCompliance(request: PaymentRequest): Promise<ComplianceDecision> {
  const decision = await determineRequirement({
    amount: request.amount,
    currency: request.currency,
    sourceType: request.sourceType,
    destinationType: request.destinationType,
  });

  if (decision.requirement === "NONE") {
    return decision;
  }

  await logSecurityEvent({
    userId: request.senderUserId,
    type: "compliance_requirement_applied",
    metadata: {
      ruleId: decision.ruleId,
      ruleType: decision.ruleType,
      requirement: decision.requirement,
      description: decision.description,
    },
  });

  if (decision.requirement === "MANUAL_REVIEW") {
    throw new OrchestratorError(
      "MANUAL_REVIEW_REQUIRED",
      `Revue manuelle requise (Compliance) : ${decision.description ?? decision.ruleId}`,
      { ruleId: decision.ruleId, ruleType: decision.ruleType }
    );
  }

  // KYC_STANDARD ou KYC_ENHANCED : ce dépôt ne modélise à ce stade qu'un
  // statut KYC binaire (identity_profiles.kyc_status) — aucun palier
  // « standard » distinct de « renforcé » n'existe encore côté données.
  // Les deux niveaux exigent donc actuellement kyc_status = 'verified'.
  // Voir docs/DECISIONS.md ADR-047, TODO_DECISION si une distinction
  // réelle entre les deux paliers est requise plus tard.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("identity_profiles")
    .select("kyc_status")
    .eq("user_id", request.senderUserId)
    .maybeSingle();

  if (!profile || profile.kyc_status !== "verified") {
    throw new OrchestratorError(
      "COMPLIANCE_REJECTION",
      `Vérification d'identité requise (${decision.requirement}) : ${decision.description ?? ""}`,
      { requirement: decision.requirement, kycStatus: profile?.kyc_status ?? "unverified", ruleId: decision.ruleId }
    );
  }

  return decision;
}
