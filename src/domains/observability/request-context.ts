import "server-only";
import { randomUUID } from "crypto";
import { headers } from "next/headers";

/**
 * Lit le request ID propagé par src/proxy.ts (en-tête `x-request-id`,
 * généré pour toute requête qui atteint l'application — Prompt 27,
 * exigence « chaque requête importante doit pouvoir être corrélée à un
 * request ID »). En génère un nouveau en repli pour tout appel hors du
 * cycle de requête HTTP (tests, jobs) plutôt que d'échouer.
 */
export async function getRequestId(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-request-id") ?? randomUUID();
  } catch {
    // headers() lève hors d'un cycle de requête HTTP (tests, jobs) —
    // jamais un cas d'erreur ici, seulement l'absence de contexte à corréler.
    return randomUUID();
  }
}
