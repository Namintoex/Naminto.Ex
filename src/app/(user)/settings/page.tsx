import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getUserProfile } from "@/domains/user/queries";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getUserProfile(user.id);
  if (!profile) {
    redirect("/login");
  }

  return <SettingsView profile={profile} email={user.email ?? null} />;
}
