import { Shell } from "@/shell/shell";
import { getCurrentUser, getIdentityProfile } from "@/domains/identity/queries";
import { getNotificationHistory } from "@/domains/notifications";

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [profile, notifications] = await Promise.all([
    user ? getIdentityProfile(user.id) : null,
    user ? getNotificationHistory(user.id) : [],
  ]);

  return (
    <Shell
      variant="user"
      homeHref="/"
      userDisplayName={profile?.naminto_id ?? null}
      notifications={notifications}
    >
      {children}
    </Shell>
  );
}
