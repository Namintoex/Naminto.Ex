import type { ChannelMode, NotificationChannel } from "@/lib/supabase/database.types";

export interface ChannelSendParams {
  title: string;
  body: string;
  /** null si aucun numéro vérifié — seul SMS l'utilise. */
  phoneNumber: string | null;
}

export interface ChannelSendResult {
  success: boolean;
  error?: string;
}

/**
 * Channel Adapter (Prompt 20) — même contrat que ProviderAdapter
 * (providers/types.ts) : le moteur de notification ne connaît jamais un
 * canal concret, seulement cette interface, résolue via `registry.ts`.
 */
export interface ChannelAdapter {
  readonly channel: NotificationChannel;
  readonly mode: ChannelMode;
  send(params: ChannelSendParams): Promise<ChannelSendResult>;
}
