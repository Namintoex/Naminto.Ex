import "server-only";
import type { DomainEventType } from "@/lib/supabase/database.types";
import type { EventConsumer } from "./types";

/**
 * Registre des consumers (Prompt 26) — même principe que le Provider
 * Registry (Prompt 07) : point d'entrée unique, jamais un import direct
 * d'un consumer concret ailleurs. Chaque fichier sous `consumers/`
 * s'enregistre lui-même à son chargement (voir `consumers/index.ts`).
 */
const registry = new Map<DomainEventType, EventConsumer[]>();

export function registerConsumer(type: DomainEventType, consumer: EventConsumer): void {
  const existing = registry.get(type) ?? [];
  existing.push(consumer);
  registry.set(type, existing);
}

export function consumersFor(type: DomainEventType): EventConsumer[] {
  return registry.get(type) ?? [];
}
