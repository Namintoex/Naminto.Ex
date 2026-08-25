import { Shell } from "@/shell/shell";
import { getCurrentUser, getIdentityProfile } from "@/domains/identity/queries";

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const profile = user ? await getIdentityProfile(user.id) : null;

  return (
    <Shell variant="user" homeHref="/" userDisplayName={profile?.naminto_id ?? null}>
      {children}
    </Shell>
  );
}
