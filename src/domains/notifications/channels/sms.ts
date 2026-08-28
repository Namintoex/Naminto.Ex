import type { ChannelAdapter, ChannelSendResult } from "./types";

/** Ne journalise jamais un numéro en clair (Prompt 28, ADR-056) — seuls les 2 derniers chiffres, suffisants pour corréler un log au bon envoi sans exposer le numéro complet. */
function maskPhoneNumber(phoneNumber: string): string {
  return `***${phoneNumber.slice(-2)}`;
}

/**
 * SMS (Prompt 20) — mode SANDBOX, même principe que les adapters
 * fournisseurs de paiement (providers/sandbox/*.ts) : simule un envoi
 * réussi sans jamais appeler d'API réelle (aucune clé de fournisseur SMS
 * en environnement), et se présente honnêtement comme SANDBOX, jamais
 * REAL (Master Prompt, section 3). Déterministe — pas d'échec aléatoire
 * simulé (même choix que le Fee/Limit/Compliance Engine : un test ne
 * doit jamais dépendre du hasard). Le seul échec possible ici est
 * légitime : aucun numéro vérifié.
 */
export const SmsChannel: ChannelAdapter = {
  channel: "SMS",
  mode: "SANDBOX",

  async send({ phoneNumber, body }): Promise<ChannelSendResult> {
    if (!phoneNumber) {
      return { success: false, error: "Aucun numéro de téléphone vérifié." };
    }
    // Numéro masqué et corps omis (Prompt 28, ADR-056) : aucun template
    // actuel ne contient de code sensible (OTP/PIN), mais ce log ne doit
    // jamais devenir la fuite par défaut le jour où l'un en contiendra.
    console.info("[notifications:sms:sandbox] SMS simulé", { to: maskPhoneNumber(phoneNumber), bodyLength: body.length });
    return { success: true };
  },
};
