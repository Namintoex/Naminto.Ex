import { adminListTickets } from "@/domains/assist";
import { requirePermission } from "@/domains/rbac";
import type { TicketStatus } from "@/lib/supabase/database.types";
import { SupportView } from "./support-view";

const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

function isTicketStatus(value: string | undefined): value is TicketStatus {
  return Boolean(value) && (TICKET_STATUSES as string[]).includes(value as string);
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requirePermission("support.read");

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const status = isTicketStatus(sp.status) ? sp.status : undefined;
  const result = await adminListTickets(status, page);

  return <SupportView result={result} status={status ?? "all"} />;
}
