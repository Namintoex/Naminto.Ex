-- NAMINTO.EX — Multi-Country / Multi-Currency (Prompt 29)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Étend `countries` (Prompt 22, déjà pensée « référence pour les
-- dimensions country des moteurs de règles ») en un véritable
-- CountryProfile : devise (déjà là), fournisseurs, rails, langues et
-- notes de confidentialité rejoignent country/currency/active. KYC,
-- AML, limits et pricing restent dans compliance_rules/limit_rules/
-- fee_rules (déjà filtrables par `country`, Prompts 10/11/19) — jamais
-- dupliqués ici, seulement agrégés à la lecture (src/domains/countries/profile.ts).

alter table public.countries
  add column if not exists languages text[] not null default '{fr}',
  add column if not exists providers text[] not null default '{}',
  add column if not exists rails text[] not null default '{}',
  add column if not exists privacy_notes text;

comment on column public.countries.languages is 'Langues supportées dans ce pays (valeurs Locale — fr/en).';
comment on column public.countries.providers is 'Fournisseurs opérant réellement dans ce pays (valeurs Provider — orange/mtn/moov/wave/prepaid_card).';
comment on column public.countries.rails is 'Rails de paiement disponibles (ex. mobile_money, card) — taxonomie non documentée dans les sources, choix raisonnable (voir docs/DECISIONS.md).';

-- Règles légales par pays (Prompt 22 n'avait aucune dimension country —
-- NULL = s'applique à tous les pays, comportement des lignes existantes
-- préservé à l'identique).
alter table public.legal_documents
  add column if not exists country text references public.countries (code) on delete set null;

comment on column public.legal_documents.country is 'NULL = document générique, s''applique à tous les pays (Prompt 29).';

-- Rend explicite ce qui était déjà implicite dans tout le cœur financier
-- (XOF, +225, Orange/MTN/Moov/Wave) plutôt que d'inventer un nouveau
-- pays : la seule donnée réelle de ce dépôt jusqu'ici.
--
-- `do update` plutôt que `do nothing` : la ligne 'CI' existe déjà depuis
-- le Prompt 22 (Countries, code/name/currency/active seulement) sur tout
-- projet ayant déjà tourné ce dépôt — un simple `do nothing` laisserait
-- providers/rails à leur défaut '{}' (bug constaté en vérification
-- manuelle du Prompt 29, corrigé en base avant ce commit).
insert into public.countries (code, name, currency, languages, providers, rails, active)
values (
  'CI',
  'Côte d''Ivoire',
  'XOF',
  '{fr}',
  '{orange,mtn,moov,wave,prepaid_card}',
  '{mobile_money,card}',
  true
)
on conflict (code) do update set
  languages = excluded.languages,
  providers = excluded.providers,
  rails = excluded.rails;
