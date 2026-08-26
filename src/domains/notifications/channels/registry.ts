import type { NotificationChannel } from "@/lib/supabase/database.types";
import type { ChannelAdapter } from "./types";
import { InAppChannel } from "./in-app";
import { PushChannel } from "./push";
import { SmsChannel } from "./sms";

/**
 * Channel Registry (Prompt 20) — même rôle que providers/registry.ts :
 * point d'entrée unique, aucun import direct d'un adapter concret
 * ailleurs. Ajouter un canal = 1) un adapter, 2) l'enregistrer ici.
 */
const registry = new Map<NotificationChannel, ChannelAdapter>([
  ["IN_APP", InAppChannel],
  ["PUSH", PushChannel],
  ["SMS", SmsChannel],
]);

export function getChannelAdapter(channel: NotificationChannel): ChannelAdapter {
  const adapter = registry.get(channel);
  if (!adapter) {
    throw new Error(`Aucun adapter enregistré pour le canal: ${channel}`);
  }
  return adapter;
}
