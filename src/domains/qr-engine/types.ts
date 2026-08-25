/**
 * QR Engine (Prompt 15) — quatre types de QR exigés par le protocole.
 * Chaque payload est signé (voir sign.ts) : le contenu n'est jamais fait
 * confiance tel quel, il est toujours revérifié (signature, expiration,
 * puis re-résolu contre l'état réel en base — jamais un simple
 * « scan → execute »).
 */
export type QrPayloadType = "BENEFICIARY" | "REQUEST" | "PAYMENT_REQUEST" | "PREFILLED_PAYMENT";

interface QrPayloadBase {
  /** Version du format — permet de faire évoluer le payload sans casser
   *  les QR déjà émis avant leur expiration. */
  v: 1;
  type: QrPayloadType;
  /** Émis le (epoch ms). */
  iat: number;
  /** Expire le (epoch ms) — un QR expiré est rejeté à la validation,
   *  jamais silencieusement accepté. */
  exp: number;
}

/**
 * Identifie un utilisateur Naminto.Ex comme bénéficiaire — aucun
 * montant. Correspond au QR de la page /receive (Prompt 14, désormais
 * signé). Ne contient aucune information secrète : `naminto_id` est déjà
 * un identifiant public.
 */
export interface BeneficiaryQrPayload extends QrPayloadBase {
  type: "BENEFICIARY";
  namintoId: string;
}

/**
 * Référence légère vers une demande d'argent (Prompt 14) — le payload ne
 * porte que le jeton, tout le reste (montant, statut, expiration réelle)
 * est toujours relu depuis `money_requests` à la résolution, jamais fait
 * confiance depuis le QR. Défini et pleinement pris en charge par le
 * moteur ; aucune UI de ce dépôt n'en génère encore (voir
 * docs/DECISIONS.md ADR-043) — PAYMENT_REQUEST est utilisé à la place.
 */
export interface RequestQrPayload extends QrPayloadBase {
  type: "REQUEST";
  token: string;
}

/**
 * Version enrichie du même objet `money_requests` — porte un instantané
 * (montant, devise, demandeur) pour un affichage immédiat, mais ce n'est
 * qu'indicatif : l'étape « resolve » relit toujours la valeur réelle en
 * base avant tout affichage définitif ou paiement.
 */
export interface PaymentRequestQrPayload extends QrPayloadBase {
  type: "PAYMENT_REQUEST";
  token: string;
  amount: number;
  currency: string;
  requesterNamintoId: string;
}

/**
 * Paiement à montant fixe vers un bénéficiaire précis, sans ligne
 * `money_requests` — aucun cycle de vie propre (pas d'annulation, pas de
 * suivi de statut), juste un montant signé prêt à confirmer. Généré
 * depuis /receive (Prompt 15) pour un « payez-moi exactement X »
 * ponctuel.
 */
export interface PrefilledPaymentQrPayload extends QrPayloadBase {
  type: "PREFILLED_PAYMENT";
  recipientUserId: string;
  recipientNamintoId: string;
  amount: number;
  currency: string;
  note: string | null;
}

export type QrPayload =
  | BeneficiaryQrPayload
  | RequestQrPayload
  | PaymentRequestQrPayload
  | PrefilledPaymentQrPayload;

export const BENEFICIARY_QR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PREFILLED_PAYMENT_QR_TTL_MS = 24 * 60 * 60 * 1000;

export type QrVerifyFailureReason =
  | "malformed"
  | "invalid_signature"
  | "invalid_payload"
  | "expired";

export type QrVerifyResult =
  | { ok: true; payload: QrPayload }
  | { ok: false; reason: QrVerifyFailureReason };
