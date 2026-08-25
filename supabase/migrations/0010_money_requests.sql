-- NAMINTO.EX — Receive + Request Money (Prompt 14)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Référence : PAYMENTS — Spécification Markdown.docx (Request Money :
-- « génère un identifiant sécurisé et expirant » ; prépare share link,
-- QR, expiration, cancellation, status), docs/DECISIONS.md ADR-042.
--
-- Receive Money n'a besoin d'aucune nouvelle table : il affiche
-- l'identité déjà connue (identity_profiles.naminto_id, Prompt 04).

create table if not exists public.money_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  -- Jeton de capacité opaque et non devinable : c'est lui, pas une policy
  -- RLS, qui contrôle l'accès en lecture depuis un lien partagé (voir
  -- ADR-042 — aucune policy select publique n'existe sur cette table).
  token text not null unique,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'cancelled', 'expired')),
  -- Renseigné une fois la demande réglée par un envoi réel (Payment
  -- Orchestrator, Prompts 09-13). NULL tant qu'aucun paiement n'a abouti.
  fulfilled_transaction_id uuid references public.transactions (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.money_requests is
  'Demandes d''argent (Prompt 14) — identifiant expirant, partageable par lien ou QR (non signé, voir Prompt 15 QR Engine pour le format QR signé/typé). "expired" est un statut calculé côté application à la lecture (expires_at dépassé) — jamais écrit automatiquement par un job, pour ne pas dépendre d''une tâche planifiée hors périmètre de ce prompt.';

create index if not exists money_requests_requester_idx on public.money_requests (requester_user_id);

drop trigger if exists set_updated_at on public.money_requests;
create trigger set_updated_at
  before update on public.money_requests
  for each row execute function public.set_updated_at();

alter table public.money_requests enable row level security;

-- Seul le demandeur peut lister ses propres demandes. Aucune policy de
-- lecture publique par jeton : la résolution d'un lien de paiement passe
-- par service_role (src/domains/payments/money-requests/queries.ts), pour
-- ne jamais exposer la table entière à l'énumération côté client.
create policy "money_requests_select_own"
  on public.money_requests for select
  using (auth.uid() = requester_user_id);

-- Aucune policy insert/update/delete cliente : création, annulation et
-- règlement passent exclusivement par service_role, qui revalide le
-- statut effectif (pending, non expiré) avant toute transition.
