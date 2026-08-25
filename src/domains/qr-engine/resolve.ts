import "server-only";
import { findRecipientByNamintoId, getPublicProfile, type RecipientLookup } from "@/domains/identity/queries";
import type { BeneficiaryQrPayload, PrefilledPaymentQrPayload } from "./types";

/**
 * Étape « resolve » pour BENEFICIARY — re-confirme que l'utilisateur
 * référencé existe toujours réellement, jamais fait confiance au seul
 * fait que la signature soit valide (une signature valide prouve
 * l'origine du QR, pas que son contenu est encore d'actualité).
 */
export async function resolveBeneficiary(payload: BeneficiaryQrPayload): Promise<RecipientLookup | null> {
  return findRecipientByNamintoId(payload.namintoId);
}

/**
 * Étape « resolve » pour PREFILLED_PAYMENT — même principe : le
 * bénéficiaire doit toujours exister réellement au moment du scan, pas
 * seulement au moment de l'émission du QR.
 */
export async function resolvePrefilledPayment(payload: PrefilledPaymentQrPayload): Promise<RecipientLookup | null> {
  return getPublicProfile(payload.recipientUserId);
}
