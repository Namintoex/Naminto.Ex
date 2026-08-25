import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser, getDevices, getSecurityEvents, hasPinSet } from "@/domains/identity/queries";
import { SecurityView } from "./security-view";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [devices, events, pinSet] = await Promise.all([
    getDevices(user.id),
    getSecurityEvents(user.id),
    hasPinSet(user.id),
  ]);

  const cookieStore = await cookies();
  const currentDeviceFingerprint = cookieStore.get("nx_device_id")?.value ?? null;

  return (
    <SecurityView
      devices={devices}
      events={events}
      pinSet={pinSet}
      currentDeviceFingerprint={currentDeviceFingerprint}
    />
  );
}
