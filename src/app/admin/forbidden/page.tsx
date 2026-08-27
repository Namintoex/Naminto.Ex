import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { ForbiddenView } from "./forbidden-view";

/**
 * Hors du groupe (protected) (Prompt 23) — n'hérite donc jamais de son
 * layout gardé par RBAC : sinon, un compte sans rôle serait redirigé
 * ici indéfiniment (boucle). Reste protégée par authentification seule.
 */
export default async function AdminForbiddenPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <ForbiddenView />;
}
