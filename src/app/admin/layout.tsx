import { Shell } from "@/shell/shell";
import { getCurrentUser, getIdentityProfile } from "@/domains/identity/queries";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const profile = user ? await getIdentityProfile(user.id) : null;

  return (
    <Shell variant="admin" homeHref="/admin" userDisplayName={profile?.naminto_id ?? null}>
      {children}
    </Shell>
  );
}
