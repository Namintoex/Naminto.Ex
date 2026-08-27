import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/**
 * Écritures Back Office — Countries (Prompt 22). Séparées de
 * admin-actions.ts ("use server") pour rester testables directement
 * (revalidatePath ne s'exécute pas hors du runtime Next.js).
 */
export async function adminCreateCountry(input: { code: string; name: string; currency: string }): Promise<AdminActionResult> {
  const code = input.code.trim().toUpperCase().slice(0, 8);
  const name = input.name.trim();
  const currency = input.currency.trim().toUpperCase() || "XOF";
  if (!code || !name) return { ok: false, error: "admin.countries.error.required" };

  const admin = createAdminClient();
  const { error } = await admin.from("countries").insert({ code, name, currency });
  if (error) return { ok: false, error: "admin.countries.error.createFailed" };

  return { ok: true };
}

export async function adminSetCountryActive(id: string, active: boolean): Promise<AdminActionResult> {
  const admin = createAdminClient();
  const { error } = await admin.from("countries").update({ active }).eq("id", id);
  if (error) return { ok: false, error: "admin.countries.error.updateFailed" };

  return { ok: true };
}
