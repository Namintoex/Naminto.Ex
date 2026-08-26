-- NAMINTO.EX — Notification Engine (Prompt 20)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Architecture : Domain Event → Notification Event → Template → Channel
-- Adapter. `notifications` est l'historique consultable par le titulaire
-- (un enregistrement par événement, dans sa langue au moment de l'envoi) ;
-- `notification_deliveries` est la plomberie interne par canal (statut,
-- tentatives) — jamais exposée au client, comme security_events.

-- Préférences par canal (Prompt 20). notifications_enabled (Prompt 04)
-- reste l'interrupteur général : si false, aucun canal n'est utilisé quel
-- que soit l'état de notify_in_app/notify_push/notify_sms.
alter table public.identity_profiles
  add column if not exists notify_in_app boolean not null default true,
  add column if not exists notify_push boolean not null default true,
  add column if not exists notify_sms boolean not null default true;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  locale text not null check (locale in ('fr', 'en')),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Historique de notifications (Prompt 20) — une ligne par événement notifié, rendue dans la langue du destinataire au moment de l''envoi. La création passe exclusivement par service_role (Notification Engine) ; le titulaire peut seulement lire et marquer comme lue sa propre ligne.';

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Marquage "lu" autorisé côté client (read_at uniquement, par convention
-- applicative — aucune règle métier à revalider, à la différence de
-- money_requests où insert/update passent par service_role).
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('IN_APP', 'PUSH', 'SMS')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  -- Distinction obligatoire (Master Prompt : "zéro fausse intégration") :
  -- trace le mode réellement utilisé pour cette tentative, jamais REAL
  -- tant qu'aucun fournisseur SMS/PUSH réel n'est connecté.
  mode text not null check (mode in ('REAL', 'SANDBOX', 'MOCK', 'UNAVAILABLE')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_deliveries is
  'Statut de livraison par canal (Prompt 20) — plomberie interne, jamais exposée au client (mêmes garanties que security_events : service_role uniquement).';

create index if not exists notification_deliveries_notification_idx on public.notification_deliveries (notification_id);
create index if not exists notification_deliveries_failed_idx on public.notification_deliveries (status) where status = 'FAILED';

drop trigger if exists set_updated_at on public.notification_deliveries;
create trigger set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;
-- Aucune policy cliente : lecture et écriture réservées à service_role.
