-- NAMINTO.EX — Back Office (Prompt 22)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- La majorité des modules du Back Office (Users, KYC, Transactions,
-- Ledger, Providers, Risk, Fraud, Support, Pricing, Notifications,
-- Audit) réutilisent des tables déjà migrées aux prompts précédents —
-- aucune nouvelle table nécessaire pour eux (voir docs/DECISIONS.md
-- ADR-050). Seuls trois modules n'avaient encore aucune table
-- (Countries, FAQ, Legal) : du contenu de référence/administratif, pas
-- une règle métier financière.
--
-- Reconciliation (Prompt 24) et Incidents (Availability Engine, Prompt
-- 47) restent des STUB : aucune table ici, rien à administrer tant que
-- le moteur sous-jacent n'existe pas.

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  currency text not null default 'XOF',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.countries is
  'Pays supportés (Prompt 22) — référence pour les dimensions "country" des moteurs de règles (fee_rules/limit_rules/compliance_rules) et pour une future validation. Purement du contenu de référence, aucune règle métier ici.';

drop trigger if exists set_updated_at on public.countries;
create trigger set_updated_at before update on public.countries for each row execute function public.set_updated_at();

alter table public.countries enable row level security;
-- Lecture publique (utile pour peupler un sélecteur pays côté produit
-- plus tard) ; écriture réservée à service_role (Back Office).
create policy "countries_select_all" on public.countries for select using (true);

create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('fr', 'en')),
  category text not null default 'general',
  question text not null,
  answer text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.faq_entries is
  'FAQ administrable (Prompt 22) — l''une des sources que Naminto Assist est censé connaître (NAMINTO.EX ARCHITECTURE GENERALE.docx, section 37). Pas encore consommée par Naminto Assist (Prompt 21, TODO_DECISION) : le contenu géré ici est pour l''instant indépendant des six thèmes de guidage codés en dur.';

drop trigger if exists set_updated_at on public.faq_entries;
create trigger set_updated_at before update on public.faq_entries for each row execute function public.set_updated_at();

alter table public.faq_entries enable row level security;
create policy "faq_entries_select_active" on public.faq_entries for select using (active = true);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy', 'pricing_disclosure', 'other')),
  locale text not null check (locale in ('fr', 'en')),
  title text not null,
  content text not null,
  version text not null default '1.0',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.legal_documents is
  'Contenus légaux administrables (Prompt 22 ; besoin déjà identifié section 50-51 de l''architecture générale — conditions, confidentialité, tarification). published=false = brouillon, jamais retourné par la lecture publique.';

drop trigger if exists set_updated_at on public.legal_documents;
create trigger set_updated_at before update on public.legal_documents for each row execute function public.set_updated_at();

alter table public.legal_documents enable row level security;
create policy "legal_documents_select_published" on public.legal_documents for select using (published = true);

-- Aucune policy insert/update/delete cliente sur les trois tables :
-- toute écriture passe par service_role (Back Office), même choix que
-- fee_rules/limit_rules/compliance_rules.
