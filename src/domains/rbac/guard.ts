import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getUserPermissions } from "./queries";
import type { Permission } from "./types";

/**
 * Garde de page (Prompt 23) — « les permissions doivent être contrôlées
 * côté serveur » : appelée en tête de chaque Server Component sous
 * /admin, jamais un simple masquage côté client. Redirige vers /login
 * si non authentifié, vers /admin/forbidden si authentifié mais sans la
 * permission requise (y compris sans aucun rôle du tout).
 */
export async function requirePermission(permission: Permission): Promise<{ userId: string }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(user.id);
  if (!permissions.has(permission)) {
    redirect("/admin/forbidden");
  }

  return { userId: user.id };
}

/**
 * Vérification côté Server Action (Prompt 23) — jamais de redirection
 * (une action renvoie un résultat typé, pas une navigation) : à appeler
 * en tout premier dans chaque action d'écriture du Back Office.
 */
export async function checkPermission(permission: Permission): Promise<{ ok: true; userId: string } | { ok: false }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const permissions = await getUserPermissions(user.id);
  if (!permissions.has(permission)) return { ok: false };

  return { ok: true, userId: user.id };
}
