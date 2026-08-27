import { redirect } from "next/navigation";
import { Shell } from "@/shell/shell";
import { getCurrentUser, getIdentityProfile } from "@/domains/identity/queries";
import { getUserPermissions } from "@/domains/rbac";

/**
 * Garde RBAC globale (Prompt 23) : authentification + au moins un rôle
 * admin, avant même de rendre le Shell/la navigation Back Office. Le
 * contrôle fin par module reste porté par chaque page (`requirePermission`)
 * et chaque action d'écriture (`checkPermission`) — cette garde n'est que
 * le premier filtre, jamais le seul.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [profile, permissions] = await Promise.all([getIdentityProfile(user.id), getUserPermissions(user.id)]);

  const permissionList = [...permissions];
  if (permissionList.length === 0) {
    redirect("/admin/forbidden");
  }

  return (
    <Shell variant="admin" homeHref="/admin" userDisplayName={profile?.naminto_id ?? null} permissions={permissionList}>
      {children}
    </Shell>
  );
}
