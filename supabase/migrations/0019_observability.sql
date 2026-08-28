-- NAMINTO.EX — Observability (Prompt 27)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Deux journaux de mesure — API latency/error rate (request_logs) et
-- provider latency/errors (provider_call_logs). Les six autres mesures
-- exigées par le prompt (transaction success rate, webhook failures,
-- reconciliation anomalies, notification failures, authentication
-- anomalies) sont dérivées de tables déjà existantes (transactions,
-- webhook_events, reconciliation_anomalies, notification_deliveries,
-- security_events) — jamais dupliquées ici.

create table if not exists public.request_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  method text not null,
  path text not null,
  status_code int not null,
  duration_ms int not null,
  user_id uuid references auth.users (id) on delete set null,
  error_message text,
  created_at timestamptz not null default now()
);

comment on table public.request_logs is
  'Latence et taux d''erreur des requêtes importantes (Prompt 27) — pas chaque requête HTTP (statiques, RSC de navigation), seulement les points d''entrée financièrement critiques (orchestrateur de paiement, webhooks). `request_id` est propagé depuis src/proxy.ts (en-tête x-request-id) pour corréler tout le traitement d''une même requête.';

create index if not exists request_logs_created_at_idx on public.request_logs (created_at desc);
create index if not exists request_logs_path_idx on public.request_logs (path);
create index if not exists request_logs_request_id_idx on public.request_logs (request_id);

create table if not exists public.provider_call_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  provider text not null
    check (provider in ('orange', 'mtn', 'moov', 'wave', 'prepaid_card')),
  operation text not null,
  duration_ms int not null,
  success boolean not null,
  error_message text,
  provider_transaction_id text,
  created_at timestamptz not null default now()
);

comment on table public.provider_call_logs is
  'Latence et erreurs du Provider Gateway (Prompt 27) — chaque appel à un ProviderAdapter (Prompt 07), quel que soit le fournisseur, instrumenté au même point central (src/domains/providers/registry.ts), jamais dans chaque adapter individuellement.';

create index if not exists provider_call_logs_created_at_idx on public.provider_call_logs (created_at desc);
create index if not exists provider_call_logs_provider_idx on public.provider_call_logs (provider);

alter table public.request_logs enable row level security;
alter table public.provider_call_logs enable row level security;
-- Aucune policy cliente sur les deux tables : lecture réservée à service_role (Back Office, permission observability.read). Écriture service_role uniquement, jamais côté client.
