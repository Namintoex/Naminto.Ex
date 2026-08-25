import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest } from "./types";

/**
 * Seuil de vérification renforcée documenté (USER — Spécification
 * Markdown, section KYC ; architecture générale, section 39). Règle
 * produit réelle, pas une invention — le reste du Compliance Engine
 * (AML/CFT, revue manuelle, seuils par pays) est le périmètre du
 * Prompt 19 et reste STUB pour l'instant.
 */
export const ENHANCED_KYC_THRESHOLD_XOF = 200_000;

/**
 * Étape 4 — Compliance. Applique la seule règle déjà définie dans les
 * documents source (seuil KYC). Tout le reste (AML/CFT, seuils par
 * pays, revue manuelle) est STUB en attendant le Prompt 19.
 */
export async function checkCompliance(request: PaymentRequest): Promise<void> {
  if (request.amount <= ENHANCED_KYC_THRESHOLD_XOF) {
    return;
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("identity_profiles")
    .select("kyc_status")
    .eq("user_id", request.senderUserId)
    .maybeSingle();

  if (!profile || profile.kyc_status !== "verified") {
    throw new OrchestratorError(
      "COMPLIANCE_REJECTION",
      `Vérification d'identité renforcée requise au-delà de ${ENHANCED_KYC_THRESHOLD_XOF} ${request.currency}`,
      { kycStatus: profile?.kyc_status ?? "unverified", threshold: ENHANCED_KYC_THRESHOLD_XOF }
    );
  }
}
