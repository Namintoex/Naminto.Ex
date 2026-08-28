import { adminListWebhookEvents, adminWebhookEventCounts } from "@/domains/webhooks";
import { requirePermission } from "@/domains/rbac";
import type { Provider, WebhookEventStatus } from "@/lib/supabase/database.types";
import { WebhooksView } from "./webhooks-view";

const PROVIDERS: Provider[] = ["orange", "mtn", "moov", "wave", "prepaid_card"];
const STATUSES: WebhookEventStatus[] = ["processed", "duplicate", "rejected"];

function isProvider(value: string | undefined): value is Provider {
  return Boolean(value) && (PROVIDERS as string[]).includes(value as string);
}
function isStatus(value: string | undefined): value is WebhookEventStatus {
  return Boolean(value) && (STATUSES as string[]).includes(value as string);
}

export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; status?: string; page?: string }>;
}) {
  await requirePermission("webhook.read");

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const provider = isProvider(sp.provider) ? sp.provider : undefined;
  const status = isStatus(sp.status) ? sp.status : undefined;

  const [result, counts] = await Promise.all([
    adminListWebhookEvents({ provider, status }, page),
    adminWebhookEventCounts(),
  ]);

  return (
    <WebhooksView result={result} counts={counts} provider={provider ?? "all"} status={status ?? "all"} />
  );
}
