import type { TransactionStatus } from "@/domains/payments/transaction-status";

/**
 * Types manuels reflétant supabase/migrations/0001_identity.sql et
 * suivantes. À remplacer par `supabase gen types typescript` une fois le
 * CLI Supabase connecté au projet (voir docs/DECISIONS.md, TODO_DECISION).
 */
export type IdentityStatus = "pending_verification" | "active" | "suspended" | "closed";
export type DeviceStatus = "active" | "untrusted" | "revoked";
export type KycStatus = "unverified" | "pending" | "verified" | "rejected" | "requires_action";
export type Locale = "fr" | "en";
export type Provider = "orange" | "mtn" | "moov" | "wave" | "prepaid_card";
export type LinkedAccountStatus =
  | "active"
  | "connection_expired"
  | "verification_required"
  | "suspended"
  | "unlinked"
  | "provider_unavailable";
export type ConsentStatus = "granted" | "revoked" | "pending";
export type SourceType = "naminto_wallet" | "linked_account";
export type DestinationType = "naminto_wallet" | "linked_account" | "external";
export type FeePayer = "sender" | "recipient";
export type FeeTransactionType = "send" | "request";
export type LimitType = "per_transaction_amount" | "daily_amount" | "monthly_amount" | "frequency_count";
export type LedgerAccountOwnerType = "user_wallet" | "provider_suspense" | "fee_revenue" | "external_suspense";
export type LedgerEntryKind = "settlement" | "reversal" | "refund";
export type LedgerEntryDirection = "debit" | "credit";
export type MoneyRequestStatus = "pending" | "fulfilled" | "cancelled" | "expired";
export type ComplianceRuleType = "PRODUCT_RULE" | "REGULATORY_RULE" | "CONFIGURATION";
export type ComplianceRequirement = "NONE" | "KYC_STANDARD" | "KYC_ENHANCED" | "MANUAL_REVIEW";
export type NotificationChannel = "IN_APP" | "PUSH" | "SMS";
export type NotificationDeliveryStatus = "PENDING" | "SENT" | "FAILED";
/** Même distinction que ProviderMode (providers/types.ts) — jamais REAL tant qu'aucun fournisseur SMS/PUSH réel n'est connecté. */
export type ChannelMode = "REAL" | "SANDBOX" | "MOCK" | "UNAVAILABLE";
export type TicketCategory = "transaction_issue" | "fees" | "account" | "other";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type LegalDocumentType = "terms" | "privacy" | "pricing_disclosure" | "other";
export type ReconciliationAnomalyType =
  | "missing"
  | "duplicate"
  | "amount_mismatch"
  | "status_mismatch"
  | "settlement_mismatch";
export type ReconciliationAnomalyStatus = "open" | "investigating" | "resolved" | "closed";
export type WebhookEventStatus = "processed" | "duplicate" | "rejected";
export type DomainEventType =
  | "TransactionCreated"
  | "TransactionValidated"
  | "TransactionAuthenticated"
  | "TransactionProcessing"
  | "ProviderConfirmed"
  | "TransactionSettled"
  | "TransactionFailed"
  | "TransactionReversed"
  | "TransactionRefunded"
  | "RiskDecisionMade"
  | "KYCStatusChanged"
  | "NotificationRequested";
export type EventDeliveryStatus = "pending" | "succeeded" | "failed" | "dead_letter";
export type EventDeliveryOutcome = "succeeded" | "failed";
export type AdminRole =
  | "support"
  | "kyc"
  | "compliance"
  | "risk"
  | "finance"
  | "operations"
  | "security"
  | "legal"
  | "super_admin";

export interface Database {
  public: {
    Tables: {
      identity_profiles: {
        Row: {
          user_id: string;
          naminto_id: string;
          legal_name: string;
          phone_number: string | null;
          phone_verified: boolean;
          status: IdentityStatus;
          preferred_language: Locale;
          kyc_status: KycStatus;
          preferred_currency: string;
          notifications_enabled: boolean;
          sound_enabled: boolean;
          notify_in_app: boolean;
          notify_push: boolean;
          notify_sms: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          naminto_id: string;
          legal_name: string;
          phone_number?: string | null;
          phone_verified?: boolean;
          status?: IdentityStatus;
          preferred_language?: Locale;
          kyc_status?: KycStatus;
          preferred_currency?: string;
          notifications_enabled?: boolean;
          sound_enabled?: boolean;
          notify_in_app?: boolean;
          notify_push?: boolean;
          notify_sms?: boolean;
        };
        Update: Partial<{
          naminto_id: string;
          legal_name: string;
          phone_number: string | null;
          phone_verified: boolean;
          status: IdentityStatus;
          preferred_language: Locale;
          kyc_status: KycStatus;
          preferred_currency: string;
          notifications_enabled: boolean;
          sound_enabled: boolean;
          notify_in_app: boolean;
          notify_push: boolean;
          notify_sms: boolean;
        }>;
        Relationships: [];
      };
      pin_credentials: {
        Row: {
          user_id: string;
          pin_hash: string;
          failed_attempts: number;
          locked_until: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          pin_hash: string;
          failed_attempts?: number;
          locked_until?: string | null;
        };
        Update: Partial<{
          pin_hash: string;
          failed_attempts: number;
          locked_until: string | null;
        }>;
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          user_id: string;
          device_fingerprint: string;
          platform: string | null;
          trusted: boolean;
          status: DeviceStatus;
          first_seen_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_fingerprint: string;
          platform?: string | null;
          trusted?: boolean;
          status?: DeviceStatus;
        };
        Update: Partial<{
          trusted: boolean;
          status: DeviceStatus;
          last_seen_at: string;
        }>;
        Relationships: [];
      };
      security_events: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          device_id: string | null;
          ip_hash: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          device_id?: string | null;
          ip_hash?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          device_id?: string | null;
          ip_hash?: string | null;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      linked_accounts: {
        Row: {
          id: string;
          user_id: string;
          provider: Provider;
          external_reference: string;
          status: LinkedAccountStatus;
          capabilities: string[];
          consent_status: ConsentStatus;
          linked_at: string;
          last_synced_at: string | null;
          unlinked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: Provider;
          external_reference: string;
          status?: LinkedAccountStatus;
          capabilities?: string[];
          consent_status?: ConsentStatus;
          linked_at?: string;
          last_synced_at?: string | null;
          unlinked_at?: string | null;
        };
        Update: Partial<{
          status: LinkedAccountStatus;
          capabilities: string[];
          consent_status: ConsentStatus;
          linked_at: string;
          last_synced_at: string | null;
          unlinked_at: string | null;
        }>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          reference: string;
          idempotency_key: string;
          sender_user_id: string | null;
          recipient_user_id: string | null;
          source_type: SourceType;
          source_reference: string | null;
          destination_type: DestinationType;
          destination_reference: string | null;
          destination_external_reference: string | null;
          provider: Provider | null;
          amount: number;
          currency: string;
          fee: number;
          total: number;
          fee_payer: FeePayer;
          status: TransactionStatus;
          provider_transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference: string;
          idempotency_key: string;
          sender_user_id?: string | null;
          recipient_user_id?: string | null;
          source_type: SourceType;
          source_reference?: string | null;
          destination_type: DestinationType;
          destination_reference?: string | null;
          destination_external_reference?: string | null;
          provider?: Provider | null;
          amount: number;
          currency?: string;
          fee?: number;
          total: number;
          fee_payer?: FeePayer;
          status?: TransactionStatus;
          provider_transaction_id?: string | null;
        };
        Update: Partial<{
          status: TransactionStatus;
          provider_transaction_id: string | null;
        }>;
        Relationships: [];
      };
      transaction_status_events: {
        Row: {
          id: string;
          transaction_id: string;
          from_status: TransactionStatus | null;
          to_status: TransactionStatus;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          from_status?: TransactionStatus | null;
          to_status: TransactionStatus;
          reason?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      fee_rules: {
        Row: {
          id: string;
          country: string | null;
          currency: string | null;
          min_amount: number | null;
          max_amount: number | null;
          source_type: SourceType | null;
          destination_type: DestinationType | null;
          provider: Provider | null;
          transaction_type: FeeTransactionType | null;
          user_tier: string | null;
          rate_percent: number;
          flat_fee: number;
          fee_payer: FeePayer;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          country?: string | null;
          currency?: string | null;
          min_amount?: number | null;
          max_amount?: number | null;
          source_type?: SourceType | null;
          destination_type?: DestinationType | null;
          provider?: Provider | null;
          transaction_type?: FeeTransactionType | null;
          user_tier?: string | null;
          rate_percent: number;
          flat_fee?: number;
          fee_payer?: FeePayer;
          active?: boolean;
        };
        Update: Partial<{
          country: string | null;
          currency: string | null;
          min_amount: number | null;
          max_amount: number | null;
          source_type: SourceType | null;
          destination_type: DestinationType | null;
          provider: Provider | null;
          transaction_type: FeeTransactionType | null;
          user_tier: string | null;
          rate_percent: number;
          flat_fee: number;
          fee_payer: FeePayer;
          active: boolean;
        }>;
        Relationships: [];
      };
      limit_rules: {
        Row: {
          id: string;
          limit_type: LimitType;
          max_amount: number | null;
          max_count: number | null;
          period_hours: number | null;
          country: string | null;
          currency: string | null;
          kyc_status: KycStatus | null;
          provider: Provider | null;
          transaction_type: FeeTransactionType | null;
          user_tier: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          limit_type: LimitType;
          max_amount?: number | null;
          max_count?: number | null;
          period_hours?: number | null;
          country?: string | null;
          currency?: string | null;
          kyc_status?: KycStatus | null;
          provider?: Provider | null;
          transaction_type?: FeeTransactionType | null;
          user_tier?: string | null;
          active?: boolean;
        };
        Update: Partial<{
          limit_type: LimitType;
          max_amount: number | null;
          max_count: number | null;
          period_hours: number | null;
          country: string | null;
          currency: string | null;
          kyc_status: KycStatus | null;
          provider: Provider | null;
          transaction_type: FeeTransactionType | null;
          user_tier: string | null;
          active: boolean;
        }>;
        Relationships: [];
      };
      ledger_accounts: {
        Row: {
          id: string;
          owner_type: LedgerAccountOwnerType;
          owner_id: string | null;
          provider: Provider | null;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_type: LedgerAccountOwnerType;
          owner_id?: string | null;
          provider?: Provider | null;
          currency: string;
        };
        Update: never;
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          transaction_id: string;
          account_id: string;
          kind: LedgerEntryKind;
          direction: LedgerEntryDirection;
          amount: number;
          currency: string;
          reference: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          account_id: string;
          kind: LedgerEntryKind;
          direction: LedgerEntryDirection;
          amount: number;
          currency: string;
          reference: string;
        };
        Update: never;
        Relationships: [];
      };
      money_requests: {
        Row: {
          id: string;
          requester_user_id: string;
          token: string;
          amount: number;
          currency: string;
          note: string | null;
          status: MoneyRequestStatus;
          fulfilled_transaction_id: string | null;
          claimed_by_user_id: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_user_id: string;
          token: string;
          amount: number;
          currency?: string;
          note?: string | null;
          status?: MoneyRequestStatus;
          fulfilled_transaction_id?: string | null;
          claimed_by_user_id?: string | null;
          expires_at: string;
        };
        Update: Partial<{
          status: MoneyRequestStatus;
          fulfilled_transaction_id: string | null;
          claimed_by_user_id: string | null;
          expires_at: string;
        }>;
        Relationships: [];
      };
      compliance_rules: {
        Row: {
          id: string;
          rule_type: ComplianceRuleType;
          requirement: ComplianceRequirement;
          country: string | null;
          currency: string | null;
          min_amount: number | null;
          max_amount: number | null;
          source_type: SourceType | null;
          destination_type: DestinationType | null;
          description: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rule_type: ComplianceRuleType;
          requirement: ComplianceRequirement;
          country?: string | null;
          currency?: string | null;
          min_amount?: number | null;
          max_amount?: number | null;
          source_type?: SourceType | null;
          destination_type?: DestinationType | null;
          description: string;
          active?: boolean;
        };
        Update: Partial<{
          rule_type: ComplianceRuleType;
          requirement: ComplianceRequirement;
          country: string | null;
          currency: string | null;
          min_amount: number | null;
          max_amount: number | null;
          source_type: SourceType | null;
          destination_type: DestinationType | null;
          description: string;
          active: boolean;
        }>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          title: string;
          body: string;
          locale: Locale;
          metadata: Record<string, unknown>;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          title: string;
          body: string;
          locale: Locale;
          metadata?: Record<string, unknown>;
          read_at?: string | null;
        };
        Update: Partial<{
          read_at: string | null;
        }>;
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: string;
          notification_id: string;
          channel: NotificationChannel;
          status: NotificationDeliveryStatus;
          mode: ChannelMode;
          attempts: number;
          last_error: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          notification_id: string;
          channel: NotificationChannel;
          status?: NotificationDeliveryStatus;
          mode: ChannelMode;
          attempts?: number;
          last_error?: string | null;
          sent_at?: string | null;
        };
        Update: Partial<{
          status: NotificationDeliveryStatus;
          attempts: number;
          last_error: string | null;
          sent_at: string | null;
        }>;
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          description: string;
          category: TicketCategory;
          related_transaction_id: string | null;
          status: TicketStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          description: string;
          category?: TicketCategory;
          related_transaction_id?: string | null;
          status?: TicketStatus;
        };
        Update: Partial<{
          status: TicketStatus;
        }>;
        Relationships: [];
      };
      countries: {
        Row: {
          id: string;
          code: string;
          name: string;
          currency: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          currency?: string;
          active?: boolean;
        };
        Update: Partial<{
          code: string;
          name: string;
          currency: string;
          active: boolean;
        }>;
        Relationships: [];
      };
      faq_entries: {
        Row: {
          id: string;
          locale: Locale;
          category: string;
          question: string;
          answer: string;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          locale: Locale;
          category?: string;
          question: string;
          answer: string;
          active?: boolean;
          sort_order?: number;
        };
        Update: Partial<{
          locale: Locale;
          category: string;
          question: string;
          answer: string;
          active: boolean;
          sort_order: number;
        }>;
        Relationships: [];
      };
      legal_documents: {
        Row: {
          id: string;
          type: LegalDocumentType;
          locale: Locale;
          title: string;
          content: string;
          version: string;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: LegalDocumentType;
          locale: Locale;
          title: string;
          content: string;
          version?: string;
          published?: boolean;
        };
        Update: Partial<{
          type: LegalDocumentType;
          locale: Locale;
          title: string;
          content: string;
          version: string;
          published: boolean;
        }>;
        Relationships: [];
      };
      admin_role_assignments: {
        Row: {
          id: string;
          user_id: string;
          role: AdminRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: AdminRole;
        };
        Update: never;
        Relationships: [];
      };
      reconciliation_anomalies: {
        Row: {
          id: string;
          transaction_id: string;
          type: ReconciliationAnomalyType;
          status: ReconciliationAnomalyStatus;
          details: Record<string, unknown>;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          type: ReconciliationAnomalyType;
          status?: ReconciliationAnomalyStatus;
          details?: Record<string, unknown>;
          note?: string | null;
        };
        Update: Partial<{
          status: ReconciliationAnomalyStatus;
          note: string | null;
        }>;
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: Provider;
          event_id: string;
          event_type: string;
          provider_transaction_id: string | null;
          transaction_id: string | null;
          occurred_at: string | null;
          received_at: string;
          signature_valid: boolean;
          status: WebhookEventStatus;
          reject_reason: string | null;
          payload: Record<string, unknown>;
          replay_of: string | null;
          replayed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: Provider;
          event_id: string;
          event_type: string;
          provider_transaction_id?: string | null;
          transaction_id?: string | null;
          occurred_at?: string | null;
          received_at?: string;
          signature_valid: boolean;
          status: WebhookEventStatus;
          reject_reason?: string | null;
          payload: Record<string, unknown>;
          replay_of?: string | null;
          replayed_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      domain_events: {
        Row: {
          id: string;
          type: DomainEventType;
          correlation_id: string;
          payload: Record<string, unknown>;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: DomainEventType;
          correlation_id: string;
          payload?: Record<string, unknown>;
          occurred_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      event_deliveries: {
        Row: {
          id: string;
          event_id: string;
          consumer: string;
          status: EventDeliveryStatus;
          attempts: number;
          next_retry_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          consumer: string;
        };
        Update: Partial<{
          status: EventDeliveryStatus;
          attempts: number;
          next_retry_at: string | null;
          last_error: string | null;
        }>;
        Relationships: [];
      };
      event_delivery_attempts: {
        Row: {
          id: string;
          delivery_id: string;
          attempt_number: number;
          started_at: string;
          finished_at: string | null;
          outcome: EventDeliveryOutcome | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          attempt_number: number;
          started_at?: string;
        };
        Update: Partial<{
          finished_at: string | null;
          outcome: EventDeliveryOutcome | null;
          error: string | null;
        }>;
        Relationships: [];
      };
      request_logs: {
        Row: {
          id: string;
          request_id: string;
          method: string;
          path: string;
          status_code: number;
          duration_ms: number;
          user_id: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          method: string;
          path: string;
          status_code: number;
          duration_ms: number;
          user_id?: string | null;
          error_message?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      provider_call_logs: {
        Row: {
          id: string;
          request_id: string | null;
          provider: Provider;
          operation: string;
          duration_ms: number;
          success: boolean;
          error_message: string | null;
          provider_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          provider: Provider;
          operation: string;
          duration_ms: number;
          success: boolean;
          error_message?: string | null;
          provider_transaction_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      login_attempts: {
        Row: {
          email_hash: string;
          failed_attempts: number;
          locked_until: string | null;
          updated_at: string;
        };
        Insert: {
          email_hash: string;
          failed_attempts?: number;
          locked_until?: string | null;
        };
        Update: Partial<{
          failed_attempts: number;
          locked_until: string | null;
        }>;
        Relationships: [];
      };
      ledger_settlement_claims: {
        Row: {
          transaction_id: string;
          kind: "settlement" | "reversal" | "refund";
          claimed_at: string;
        };
        Insert: {
          transaction_id: string;
          kind: "settlement" | "reversal" | "refund";
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      bootstrap_super_admin: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      increment_pin_failed_attempts: {
        Args: { p_user_id: string; p_max_attempts: number; p_lockout_minutes: number };
        Returns: { attempts: number; locked: boolean; locked_until: string | null }[];
      };
      record_login_failure: {
        Args: { p_email_hash: string; p_max_attempts: number; p_lockout_minutes: number };
        Returns: { attempts: number; locked: boolean; locked_until: string | null }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
