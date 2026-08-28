-- NAMINTO.EX — Event Bus (Prompt 26)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Journal d'événements append-only (domain_events) + suivi de livraison
-- par consommateur (event_deliveries, une ligne par (event, consumer) —
-- clé d'idempotence infrastructurelle) + trace complète de chaque
-- tentative (event_delivery_attempts). Aucun ordonnanceur/cron externe :
-- une tentative immédiate a lieu à la publication (best-effort), le lot
-- manuel Back Office couvre le reste (retry/dead-letter).

create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'TransactionCreated', 'TransactionValidated', 'TransactionAuthenticated',
    'TransactionProcessing', 'ProviderConfirmed', 'TransactionSettled',
    'TransactionFailed', 'TransactionReversed', 'TransactionRefunded',
    'RiskDecisionMade', 'KYCStatusChanged', 'NotificationRequested'
  )),
  correlation_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.domain_events is
  'Journal append-only de tout événement métier publié (Prompt 26) — jamais modifié après écriture. `correlation_id` regroupe tous les événements d''une même opération (id de transaction pour le cycle de vie transactionnel, id utilisateur pour KYCStatusChanged).';

create index if not exists domain_events_correlation_idx on public.domain_events (correlation_id);
create index if not exists domain_events_type_idx on public.domain_events (type);
create index if not exists domain_events_created_at_idx on public.domain_events (created_at desc);

create table if not exists public.event_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.domain_events (id),
  consumer text not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'dead_letter')),
  attempts int not null default 0,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, consumer)
);

comment on table public.event_deliveries is
  'Un consommateur ne peut jamais être enregistré deux fois pour le même événement (unique(event_id, consumer)) — c''est la garantie d''idempotence infrastructurelle exigée par le Prompt 26 (« chaque consumer doit être idempotent »), au-dessus de laquelle chaque consommateur ajoute sa propre garantie applicative.';

create index if not exists event_deliveries_status_idx on public.event_deliveries (status) where status in ('pending', 'failed');
create index if not exists event_deliveries_event_idx on public.event_deliveries (event_id);

create table if not exists public.event_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.event_deliveries (id),
  attempt_number int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text check (outcome in ('succeeded', 'failed')),
  error text
);

comment on table public.event_delivery_attempts is
  'Trace complète (Prompt 26, exigence « tracing ») de chaque tentative de livraison — jamais résumée en un simple compteur.';

create index if not exists event_delivery_attempts_delivery_idx on public.event_delivery_attempts (delivery_id);

drop trigger if exists set_updated_at on public.event_deliveries;
create trigger set_updated_at
  before update on public.event_deliveries
  for each row execute function public.set_updated_at();

alter table public.domain_events enable row level security;
alter table public.event_deliveries enable row level security;
alter table public.event_delivery_attempts enable row level security;
-- Aucune policy cliente sur les trois tables : lecture et écriture réservées à service_role (Back Office, permission event.*).
