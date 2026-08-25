import "server-only";
import type { PaymentRequest } from "./types";

/**
 * Taux initial documenté (architecture générale, section 27 : « 3,5 %
 * pour 1 000 FCFA, avec une évolution selon les montants »). Seule la
 * partie fixe (3,5 % flat) est implémentée ici — la progressivité par
 * palier et la configurabilité par pays/devise/fournisseur sont le
 * périmètre explicite du Fee Engine (Prompt 10). Ne pas coder cette
 * règle en dur ailleurs : ce module est le seul endroit qui la connaît.
 */
export const INITIAL_FEE_RATE = 0.035;

export interface FeeResult {
  fee: number;
  senderDebit: number;
  recipientCredit: number;
}

/**
 * Étape 6 — Fee. Calcul minimal (taux fixe) en attendant le Fee Engine
 * configurable du Prompt 10. `feePayer` (expéditeur/destinataire) n'est
 * pas encore un choix exposé — l'expéditeur paie toujours les frais pour
 * l'instant (règle par défaut la plus simple, à raffiner au Prompt 10).
 */
export async function calculateFee(request: PaymentRequest): Promise<FeeResult> {
  const fee = Math.round(request.amount * INITIAL_FEE_RATE * 100) / 100;
  return {
    fee,
    senderDebit: request.amount + fee,
    recipientCredit: request.amount,
  };
}
