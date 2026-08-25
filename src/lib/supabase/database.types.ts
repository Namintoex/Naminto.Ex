/**
 * Types manuels reflétant supabase/migrations/0001_identity.sql et
 * 0002_user_profile.sql. À remplacer par `supabase gen types typescript`
 * une fois le CLI Supabase connecté au projet (voir docs/DECISIONS.md,
 * TODO_DECISION).
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
