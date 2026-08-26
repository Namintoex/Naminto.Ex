import type { ChannelAdapter, ChannelSendResult } from "./types";

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
    console.info("[notifications:sms:sandbox] SMS simulé", { to: phoneNumber, body });
    return { success: true };
  },
};
