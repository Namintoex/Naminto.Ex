import { adminListUsers } from "@/domains/identity/admin-queries";
import type { KycStatus } from "@/lib/supabase/database.types";
import { KycView } from "./kyc-view";

const KYC_STATUSES: KycStatus[] = ["pending", "requires_action", "unverified", "verified", "rejected"];

function isKycStatus(value: string | undefined): value is KycStatus {
  return Boolean(value) && (KYC_STATUSES as string[]).includes(value as string);
}

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const status = sp.status === "all" ? undefined : isKycStatus(sp.status) ? sp.status : "pending";
  const result = await adminListUsers({ kycStatus: status }, page);

  return <KycView result={result} status={status ?? "all"} />;
}
