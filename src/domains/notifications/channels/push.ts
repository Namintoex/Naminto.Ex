import type { ChannelAdapter, ChannelSendResult } from "./types";

/**
 * PUSH (Prompt 20) — mode UNAVAILABLE assumé : ce dépôt ne modélise
 * aucun jeton d'appareil push (voir database.types.ts, table `devices` —
 * device_fingerprint/platform/trusted, jamais de push token) et
 * n'intègre aucun fournisseur (FCM/APNs). Se présenter en MOCK ou REAL
 * ici serait une fausse intégration (Master Prompt, section 3) : on
 * échoue explicitement plutôt que de simuler un envoi qui n'existe pas.
 * TODO_DECISION (docs/DECISIONS.md) si l'enregistrement de jetons push
 * devient un prérequis produit.
 */
export const PushChannel: ChannelAdapter = {
  channel: "PUSH",
  mode: "UNAVAILABLE",

  async send(): Promise<ChannelSendResult> {
    return {
      success: false,
      error: "PUSH indisponible : aucun fournisseur ni jeton d'appareil connecté.",
    };
  },
};
