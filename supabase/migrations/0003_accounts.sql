-- NAMINTO.EX — Domaine Accounts / Linked Accounts (Prompt 06)
--
-- Référence : NAMINTO.EX ARCHITECTURE GENERALE.docx sections 10-12, Prompt 06.
-- IMPORTANT : le Provider Gateway (Prompt 07) n'existe pas encore. Cette
-- table décrit des comptes "liés" créés via un formulaire de consentement
-- côté Naminto.Ex — aucune connexion réelle à Orange/MTN/Moov/Wave n'est
-- établie à ce stade (voir docs/DECISIONS.md). Aucun PIN ni identifiant
-- fournisseur sensible n'est demandé ou stocké ici.

create table if not exists public.linked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('orange', 'mtn', 'moov', 'wave', 'prepaid_card')),
  external_reference text not null,
  status text not null default 'active'
    check (status in (
      'active', 'connection_expired', 'verification_required',
      'suspended', 'unlinked', 'provider_unavailable'
    )),
  capabilities text[] not null default '{}',
  consent_status text not null default 'granted'
    check (consent_status in ('granted', 'revoked', 'pending')),
  linked_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unlinked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_reference)
);

comment on table public.linked_accounts is
  'Comptes externes liés par l''utilisateur (Orange, MTN, Moov, Wave, cartes prépayées). Aucune intégration fournisseur réelle avant le Provider Gateway (Prompt 07) — voir docs/DECISIONS.md.';
comment on column public.linked_accounts.external_reference is
  'Référence externe (ex. numéro de téléphone du compte opérateur). Toujours masquée côté UI (derniers chiffres uniquement) — jamais un PIN ou secret fournisseur.';

create index if not exists linked_accounts_user_id_idx on public.linked_accounts (user_id);

drop trigger if exists set_updated_at on public.linked_accounts;
create trigger set_updated_at
  before update on public.linked_accounts
  for each row execute function public.set_updated_at();

alter table public.linked_accounts enable row level security;

create policy "linked_accounts_select_own"
  on public.linked_accounts for select
  using (auth.uid() = user_id);

create policy "linked_accounts_insert_own"
  on public.linked_accounts for insert
  with check (auth.uid() = user_id);

create policy "linked_accounts_update_own"
  on public.linked_accounts for update
  using (auth.uid() = user_id);
