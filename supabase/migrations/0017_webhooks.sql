-- NAMINTO.EX — Webhooks (Prompt 25)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Journal append-only de toute requête reçue sur /api/webhooks/[provider],
-- qu'elle ait été acceptée ou rejetée — rien n'est jamais ignoré
-- silencieusement (Master Prompt, exigence « audité »). Aucune ligne
-- n'est jamais mise à jour après coup ; un rejeu contrôlé (Back Office,
-- permission webhook.manage) insère une nouvelle ligne référencée par
-- `replay_of`, jamais une modification de l'originale.

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null
    check (provider in ('orange', 'mtn', 'moov', 'wave', 'prepaid_card')),
  event_id text not null,
  event_type text not null,
  provider_transaction_id text,
  transaction_id uuid references public.transactions (id),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  signature_valid boolean not null,
  status text not null check (status in ('processed', 'duplicate', 'rejected')),
  reject_reason text,
  payload jsonb not null,
  replay_of uuid references public.webhook_events (id),
  replayed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

comment on table public.webhook_events is
  'Journal append-only de tout webhook reçu (Prompt 25) — accepté ou rejeté, jamais ignoré. `event_id` est l''identifiant fourni par le fournisseur (idempotence applicative, vérifiée en code avant traitement, pas une contrainte unique en base pour ne pas bloquer un rejeu contrôlé légitime portant le même event_id). `replay_of`/`replayed_by` tracent un rejeu explicite déclenché depuis le Back Office.';

create index if not exists webhook_events_provider_event_idx
  on public.webhook_events (provider, event_id);
create index if not exists webhook_events_provider_tx_idx
  on public.webhook_events (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create index if not exists webhook_events_status_idx on public.webhook_events (status);
create index if not exists webhook_events_created_at_idx on public.webhook_events (created_at desc);

alter table public.webhook_events enable row level security;
-- Aucune policy cliente : lecture et écriture réservées à service_role (Back Office, permission webhook.*).
