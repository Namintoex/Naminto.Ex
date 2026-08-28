import { adminEventDeliveryCounts, adminListEventDeliveries } from "@/domains/event-bus";
import { DOMAIN_EVENT_TYPES } from "@/domains/event-bus/types";
import { requirePermission } from "@/domains/rbac";
import type { DomainEventType, EventDeliveryStatus } from "@/lib/supabase/database.types";
import { EventsView } from "./events-view";

const STATUSES: EventDeliveryStatus[] = ["pending", "succeeded", "failed", "dead_letter"];

function isStatus(value: string | undefined): value is EventDeliveryStatus {
  return Boolean(value) && (STATUSES as string[]).includes(value as string);
}
function isType(value: string | undefined): value is DomainEventType {
  return Boolean(value) && (DOMAIN_EVENT_TYPES as string[]).includes(value as string);
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>;
}) {
  await requirePermission("event.read");

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const status = isStatus(sp.status) ? sp.status : undefined;
  const type = isType(sp.type) ? sp.type : undefined;

  const [result, counts] = await Promise.all([
    adminListEventDeliveries({ status, type }, page),
    adminEventDeliveryCounts(),
  ]);

  return <EventsView result={result} counts={counts} status={status ?? "all"} type={type ?? "all"} />;
}
