-- NAMINTO.EX — Naminto Assist (Prompt 21)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Référence : NAMINTO.EX ARCHITECTURE GENERALE.docx, section 37-38 —
-- workflow des cas sensibles : Naminto Assist → Diagnostic → Dossier
-- support → Agent humain. Cette table est le « Dossier support » ; sa
-- prise en charge par un agent humain (statut, réponses) est le module
-- Support du Back Office (Prompt 22), hors périmètre ici.
--
-- Volontairement : aucune conversation n'est persistée (le fil de
-- discussion reste côté client, jamais écrit en base) — seul le
-- résultat d'une escalade (un ticket) l'est, conformément au principe
-- déjà énoncé dans les sources : ne pas stocker inutilement des données
-- personnelles.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  description text not null,
  category text not null default 'other'
    check (category in ('transaction_issue', 'fees', 'account', 'other')),
  related_transaction_id uuid references public.transactions (id),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_tickets is
  'Dossiers support créés depuis Naminto Assist (Prompt 21) quand une demande dépasse ce que l''assistant peut résoudre seul, ou sur demande explicite. La prise en charge (changement de statut, réponse) revient à un agent humain via le Back Office (Support, Prompt 22) — non implémenté ici.';

create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

drop trigger if exists set_updated_at on public.support_tickets;
create trigger set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

create policy "support_tickets_select_own"
  on public.support_tickets for select
  using (auth.uid() = user_id);

-- Aucune policy insert/update/delete cliente : la création d'un ticket
-- passe exclusivement par service_role (src/domains/assist/create-ticket.ts,
-- déjà scopée à l'utilisateur authentifié par le Server Action appelant)
-- — même choix que money_requests (0010_money_requests.sql). Le
-- changement de statut revient exclusivement à un agent humain (Back
-- Office, service_role), jamais au titulaire ni à Naminto Assist.
