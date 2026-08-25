import type { Provider } from "@/lib/supabase/database.types";

/**
 * Métadonnées purement visuelles (libellé, couleur). Les capacités réelles
 * d'un compte lié viennent désormais du Provider Gateway (Prompt 07,
 * src/domains/providers/registry.ts), jamais d'ici.
 */
export type ProviderConfig = {
  id: Provider;
  labelKey: string;
  dotClassName: string;
};

export const PROVIDERS: ProviderConfig[] = [
  { id: "orange", labelKey: "provider.orange", dotClassName: "bg-orange-500" },
  { id: "mtn", labelKey: "provider.mtn", dotClassName: "bg-yellow-500" },
  { id: "moov", labelKey: "provider.moov", dotClassName: "bg-blue-500" },
  { id: "wave", labelKey: "provider.wave", dotClassName: "bg-sky-500" },
  { id: "prepaid_card", labelKey: "provider.prepaidCard", dotClassName: "bg-slate-500" },
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
