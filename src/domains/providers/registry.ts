import "server-only";
import type { Provider } from "@/lib/supabase/database.types";
import type { ProviderAdapter } from "./types";
import { OrangeSandbox } from "./sandbox/orange";
import { MTNSandbox } from "./sandbox/mtn";
import { MoovSandbox } from "./sandbox/moov";
import { WaveSandbox } from "./sandbox/wave";
import { CardSandbox } from "./sandbox/card";

/**
 * Provider Registry (Prompt 07). Point d'entrée unique vers les
 * fournisseurs pour tout le cœur financier — jamais d'import direct d'un
 * adapter concret ailleurs dans l'application.
 *
 * Ajouter un fournisseur = 1) un adapter (voir sandbox/*.ts),
 * 2) l'enregistrer ci-dessous. Aucune autre modification requise.
 */
const registry = new Map<Provider, ProviderAdapter>();

function registerAdapter(adapter: ProviderAdapter) {
  registry.set(adapter.provider, adapter);
}

registerAdapter(OrangeSandbox);
registerAdapter(MTNSandbox);
registerAdapter(MoovSandbox);
registerAdapter(WaveSandbox);
registerAdapter(CardSandbox);

export function getProviderAdapter(provider: Provider): ProviderAdapter {
  const adapter = registry.get(provider);
  if (!adapter) {
    throw new Error(`Aucun adapter enregistré pour le fournisseur: ${provider}`);
  }
  return adapter;
}

export function listRegisteredProviders(): Provider[] {
  return [...registry.keys()];
}
