import type { Database, Provider } from "@/lib/supabase/database.types";

export type RequestLogRow = Database["public"]["Tables"]["request_logs"]["Row"];
export type ProviderCallLogRow = Database["public"]["Tables"]["provider_call_logs"]["Row"];

export interface LogApiRequestParams {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string | null;
  errorMessage?: string | null;
}

export interface LogProviderCallParams {
  requestId?: string | null;
  provider: Provider;
  operation: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string | null;
  providerTransactionId?: string | null;
}
