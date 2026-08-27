import { redirect } from "next/navigation";
import { getCurrentUser } from "@/domains/identity/queries";
import { AssistView } from "./assist-view";

export default async function AssistPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <AssistView />;
}
