import type { ChannelAdapter, ChannelSendResult } from "./types";

/**
 * IN_APP (Prompt 20) — mode REAL réel et non simulé : la ligne
 * `notifications` déjà écrite par `send-notification.ts` EST la
 * livraison, aucun système externe à appeler. `send()` ne fait donc
 * jamais que confirmer, jamais échouer.
 */
export const InAppChannel: ChannelAdapter = {
  channel: "IN_APP",
  mode: "REAL",

  async send(): Promise<ChannelSendResult> {
    return { success: true };
  },
};
