import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale, Provider } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const VALID_PROVIDERS: Provider[] = ["orange", "mtn", "moov", "wave", "prepaid_card"];
const VALID_LOCALES: Locale[] = ["fr", "en"];

/** Découpe une liste texte séparée par des virgules — jamais un tableau vide sur une entrée vide. */
function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean))];
}

export interface AdminCreateCountryInput {
  code: string;
  name: string;
  currency: string;
  /** Liste séparée par des virgules (ex. "fr,en") — Prompt 29. */
  languages?: string;
  /** Liste séparée par des virgules parmi orange/mtn/moov/wave/prepaid_card — Prompt 29. */
  providers?: string;
  /** Liste libre séparée par des virgules (ex. "mobile_money,card") — Prompt 29. */
  rails?: string;
  privacyNotes?: string;
}

/**
 * Écritures Back Office — Countries (Prompt 22, étendu au CountryProfile
 * complet au Prompt 29). Séparées de admin-actions.ts ("use server")
 * pour rester testables directement (revalidatePath ne s'exécute pas
 * hors du runtime Next.js). Les fournisseurs/langues invalides sont
 * silencieusement écartés plutôt que de rejeter toute la saisie — un
 * choix d'ergonomie pour un écran interne, pas une donnée exposée au client.
 */
export async function adminCreateCountry(input: AdminCreateCountryInput): Promise<AdminActionResult> {
  const code = input.code.trim().toUpperCase().slice(0, 8);
  const name = input.name.trim();
  const currency = input.currency.trim().toUpperCase() || "XOF";
  if (!code || !name) return { ok: false, error: "admin.countries.error.required" };

  const languages = parseList(input.languages).filter((l): l is Locale => VALID_LOCALES.includes(l as Locale));
  const providers = parseList(input.providers).filter((p): p is Provider => VALID_PROVIDERS.includes(p as Provider));
  const rails = parseList(input.rails);
  const privacyNotes = input.privacyNotes?.trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("countries").insert({
    code,
    name,
    currency,
    languages: languages.length > 0 ? languages : undefined,
    providers,
    rails,
    privacy_notes: privacyNotes,
  });
  if (error) return { ok: false, error: "admin.countries.error.createFailed" };

  return { ok: true };
}

export async function adminSetCountryActive(id: string, active: boolean): Promise<AdminActionResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("countries").update({ active }).eq("id", id).select("id").maybeSingle();
  if (error) return { ok: false, error: "admin.countries.error.updateFailed" };
  // Un id inexistant/périmé (revue de code) ne doit jamais "réussir"
  // silencieusement — Supabase ne renvoie aucune erreur pour un UPDATE qui
  // ne touche aucune ligne.
  if (!data) return { ok: false, error: "admin.countries.error.updateFailed" };

  return { ok: true };
}
