import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_reset_requested"
  | "password_changed"
  | "pin_created"
  | "pin_changed"
  | "pin_verification_failed"
  | "pin_locked"
  | "device_added"
  | "device_revoked"
  | "new_device_login"
  | "preferences_updated"
  | "account_linked"
  | "account_reconnected"
  | "account_unlinked"
  | "money_request_created"
  | "money_request_cancelled"
  | "fraud_rule_matched"
  | "compliance_requirement_applied"
  | "kyc_status_changed"
  | "support_ticket_status_changed"
  | "admin_role_changed"
  | "user_status_changed";

/**
 * Écrit un événement de sécurité append-only. Utilise toujours le client
 * service_role : la table security_events n'autorise aucune écriture
 * cliente (voir supabase/migrations/0001_identity.sql), y compris pour le
 * titulaire du compte.
 */
export async function logSecurityEvent(params: {
  userId: string;
  type: SecurityEventType;
  deviceId?: string | null;
  ipHash?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("security_events").insert({
    user_id: params.userId,
    type: params.type,
    device_id: params.deviceId ?? null,
    ip_hash: params.ipHash ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("logSecurityEvent failed", { type: params.type, error });
  }
}
