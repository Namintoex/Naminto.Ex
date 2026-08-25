import type { Provider } from "@/lib/supabase/database.types";

export type ProviderConfig = {
  id: Provider;
  labelKey: string;
  /** Capacités statiques provisoires — deviendront dynamiques avec le
   *  Provider Gateway (Prompt 07) et son registre d'adapters. */
  capabilities: string[];
  dotClassName: string;
};

export const PROVIDERS: ProviderConfig[] = [
  { id: "orange", labelKey: "provider.orange", capabilities: ["balance", "transfer", "receive"], dotClassName: "bg-orange-500" },
  { id: "mtn", labelKey: "provider.mtn", capabilities: ["balance", "transfer", "receive"], dotClassName: "bg-yellow-500" },
  { id: "moov", labelKey: "provider.moov", capabilities: ["balance", "transfer", "receive"], dotClassName: "bg-blue-500" },
  { id: "wave", labelKey: "provider.wave", capabilities: ["balance", "transfer", "receive"], dotClassName: "bg-sky-500" },
  { id: "prepaid_card", labelKey: "provider.prepaidCard", capabilities: ["balance", "transfer"], dotClassName: "bg-slate-500" },
];

export function getProviderConfig(id: Provider): ProviderConfig {
  const config = PROVIDERS.find((p) => p.id === id);
  if (!config) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return config;
}

export function maskExternalReference(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "••••";
  }
  return `•••• ${digits.slice(-4)}`;
}
