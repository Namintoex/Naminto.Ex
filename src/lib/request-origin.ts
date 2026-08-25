import "server-only";
import { headers } from "next/headers";

/**
 * Reconstruit l'origine absolue de la requête courante. `Origin` n'est
 * envoyé par le navigateur que sur certaines requêtes (POST/fetch), pas
 * sur une navigation GET classique — un Server Component qui en dépendait
 * directement (comme la première version de cette page) recevait donc une
 * chaîne vide. `Host` (ou `x-forwarded-host` derrière un proxy) est
 * toujours présent.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
