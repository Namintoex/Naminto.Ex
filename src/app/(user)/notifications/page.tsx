import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { getNotificationHistory } from "@/domains/notifications";
import { NotificationsView } from "./notifications-view";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const notifications = await getNotificationHistory(user.id);

  return <NotificationsView notifications={notifications} />;
}
