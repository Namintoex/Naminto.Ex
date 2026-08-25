-- NAMINTO.EX — Domaine Identity (Prompt 04)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Référence : IDENTITY — Spécification Markdown.docx, docs/ARCHITECTURE.md.
-- Le mot de passe est géré par Supabase Auth (auth.users) ; le PIN
-- Naminto.Ex est un secret strictement distinct, stocké ici.

-- ============================================================
-- 1. identity_profiles — extension du profil d'identité
-- ============================================================
create table if not exists public.identity_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  naminto_id text not null unique,
  legal_name text not null,
  phone_number text,
  phone_verified boolean not null default false,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'active', 'suspended', 'closed')),
  preferred_language text not null default 'fr' check (preferred_language in ('fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.identity_profiles is
  'Extension du profil Identity au-delà de auth.users (naminto_id, nom légal, statut). Racine de toutes les fonctionnalités personnelles.';

-- ============================================================
-- 2. pin_credentials — PIN Naminto.Ex, strictement séparé du mot de passe
-- ============================================================
create table if not exists public.pin_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.pin_credentials is
  'PIN Naminto.Ex haché — jamais lisible côté client (RLS: aucun SELECT hors service_role). Utilisé pour confirmer les opérations sensibles, indépendant du mot de passe.';

-- ============================================================
-- 3. devices — appareils autorisés
-- ============================================================
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_fingerprint text not null,
  platform text,
  trusted boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'untrusted', 'revoked')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

comment on table public.devices is
  'Appareils associés à une identité Naminto.Ex. Le statut revoked invalide les sessions associées (voir security_events).';

-- ============================================================
-- 4. security_events — historique de sécurité (append-only)
-- ============================================================
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  device_id uuid references public.devices (id) on delete set null,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.security_events is
  'Historique de sécurité append-only. Écrit uniquement côté serveur (service_role) — jamais par le client, même le titulaire du compte. Voir aussi la spécification AUDIT.';

create index if not exists security_events_user_id_created_at_idx
  on public.security_events (user_id, created_at desc);

-- ============================================================
-- 5. updated_at automatique
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.identity_profiles;
create trigger set_updated_at
  before update on public.identity_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.pin_credentials;
create trigger set_updated_at
  before update on public.pin_credentials
  for each row execute function public.set_updated_at();

-- ============================================================
-- 6. Création automatique du profil à l'inscription
-- ============================================================
-- signUp() doit passer naminto_id / legal_name / phone_number dans
-- options.data (user_metadata) — voir src/app/(auth)/register.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.identity_profiles (user_id, naminto_id, legal_name, phone_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'naminto_id', 'nx_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'legal_name', ''),
    new.raw_user_meta_data ->> 'phone_number'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 7. Row Level Security
-- ============================================================
alter table public.identity_profiles enable row level security;
alter table public.pin_credentials enable row level security;
alter table public.devices enable row level security;
alter table public.security_events enable row level security;

-- identity_profiles : l'utilisateur lit/modifie uniquement son propre profil.
create policy "identity_profiles_select_own"
  on public.identity_profiles for select
  using (auth.uid() = user_id);

create policy "identity_profiles_update_own"
  on public.identity_profiles for update
  using (auth.uid() = user_id);

-- pin_credentials : aucun SELECT côté client (même pas la sienne) — la
-- vérification du PIN passe toujours par un Route Handler en service_role.
-- L'utilisateur peut créer/mettre à jour son propre hash (calculé côté
-- serveur avant l'appel), jamais le lire.
create policy "pin_credentials_insert_own"
  on public.pin_credentials for insert
  with check (auth.uid() = user_id);

create policy "pin_credentials_update_own"
  on public.pin_credentials for update
  using (auth.uid() = user_id);

-- devices : l'utilisateur gère ses propres appareils.
create policy "devices_select_own"
  on public.devices for select
  using (auth.uid() = user_id);

create policy "devices_insert_own"
  on public.devices for insert
  with check (auth.uid() = user_id);

create policy "devices_update_own"
  on public.devices for update
  using (auth.uid() = user_id);

-- security_events : lecture seule pour le titulaire, écriture réservée au
-- service_role (aucune policy INSERT/UPDATE/DELETE pour anon/authenticated).
create policy "security_events_select_own"
  on public.security_events for select
  using (auth.uid() = user_id);
