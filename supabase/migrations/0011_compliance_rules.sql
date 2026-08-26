-- NAMINTO.EX — Compliance Engine (Prompt 19)
--
-- Référence : Prompt 19 (« ne code aucune règle réglementaire comme une
-- vérité universelle » ; « sépare PRODUCT_RULE / REGULATORY_RULE /
-- CONFIGURATION » ; « les seuils doivent être configurables »),
-- docs/DECISIONS.md ADR-047. Même principe que fee_rules (Prompt 10) et
-- limit_rules (Prompt 11) : NULL = joker sur une dimension, la règle
-- active la plus spécifique qui correspond à la requête est retenue.
--
-- Remplace le seuil KYC codé en dur (ENHANCED_KYC_THRESHOLD_XOF,
-- orchestrator-steps/compliance.ts, Prompt 09) par une donnée
-- configurable, tagué de sa provenance (rule_type) plutôt que présenté
-- comme une vérité universelle immuable.

create table if not exists public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  -- Provenance de la règle — jamais mélangée : une règle produit n'a pas
  -- la même autorité qu'une règle réglementaire ou qu'un simple paramètre
  -- opérationnel (CONFIGURATION).
  rule_type text not null check (rule_type in ('PRODUCT_RULE', 'REGULATORY_RULE', 'CONFIGURATION')),
  requirement text not null check (requirement in ('NONE', 'KYC_STANDARD', 'KYC_ENHANCED', 'MANUAL_REVIEW')),
  country text,
  currency text,
  min_amount numeric(14, 2),
  max_amount numeric(14, 2),
  source_type text check (source_type in ('naminto_wallet', 'linked_account')),
  destination_type text check (destination_type in ('naminto_wallet', 'linked_account', 'external')),
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);

comment on table public.compliance_rules is
  'Règles de conformité configurables (Compliance Engine, Prompt 19). NULL = joker sur cette dimension. La règle active la plus spécifique qui correspond à la requête détermine le niveau de vérification requis — jamais une règle codée en dur dans l''application.';

create index if not exists compliance_rules_active_idx on public.compliance_rules (active);

drop trigger if exists set_updated_at on public.compliance_rules;
create trigger set_updated_at
  before update on public.compliance_rules
  for each row execute function public.set_updated_at();

alter table public.compliance_rules enable row level security;
-- Aucune policy cliente : lecture et écriture réservées au service_role
-- pour l'instant (pas d'UI Back Office de conformité avant le Prompt 22).

-- Seule règle documentée à ce jour (architecture générale, section 39 ;
-- USER — Spécification Markdown) : vérification renforcée au-delà de
-- 200 000 XOF par transaction. Étiquetée REGULATORY_RULE plutôt que
-- codée en dur — une opération peut la modifier ou la désactiver sans
-- toucher au code.
insert into public.compliance_rules (rule_type, requirement, currency, min_amount, description)
select
  'REGULATORY_RULE',
  'KYC_ENHANCED',
  'XOF',
  200000.01,
  'Vérification d''identité renforcée requise au-delà de 200 000 XOF par transaction.'
where not exists (
  select 1 from public.compliance_rules
  where requirement = 'KYC_ENHANCED'
    and currency = 'XOF'
    and min_amount = 200000.01
    and country is null and max_amount is null
    and source_type is null and destination_type is null
);
