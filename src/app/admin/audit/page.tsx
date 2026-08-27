import { adminListSecurityEvents } from "@/domains/identity/admin-audit-queries";
import type { SecurityEventType } from "@/domains/identity/security-events";
import { AuditView } from "./audit-view";

const SECURITY_EVENT_TYPES: SecurityEventType[] = [
  "login_success",
  "login_failed",
  "logout",
  "password_reset_requested",
  "password_changed",
  "pin_created",
  "pin_changed",
  "pin_verification_failed",
  "pin_locked",
  "device_added",
  "device_revoked",
  "new_device_login",
  "preferences_updated",
  "account_linked",
  "account_reconnected",
  "account_unlinked",
  "money_request_created",
  "money_request_cancelled",
  "fraud_rule_matched",
  "compliance_requirement_applied",
  "kyc_status_changed",
  "support_ticket_status_changed",
];

function isSecurityEventType(value: string | undefined): value is SecurityEventType {
  return Boolean(value) && (SECURITY_EVENT_TYPES as string[]).includes(value as string);
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const type = isSecurityEventType(sp.type) ? sp.type : undefined;
  const result = await adminListSecurityEvents(type, page);

  return <AuditView result={result} type={type ?? "all"} eventTypes={SECURITY_EVENT_TYPES} />;
}
