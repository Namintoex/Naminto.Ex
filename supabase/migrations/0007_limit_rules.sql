-- NAMINTO.EX — Limit Engine (Prompt 11)
--
-- Référence : architecture générale section 43, Prompt 11. Une règle
-- correspond si toutes ses dimensions contraintes (non NULL) égalent la
-- requête — même principe que fee_rules (Prompt 10).
--
-- IMPORTANT : contrairement au Fee Engine, aucune valeur de limite
-- n'est documentée dans les sources du projet. Aucune règle n'est semée
-- ici — une table vide signifie « aucune limite configurée », jamais
-- « transaction refusée ». Voir docs/DECISIONS.md, TODO_DECISION.

create table if not exists public.limit_rules (
  id uuid primary key default gen_random_uuid(),
  limit_type text not null check (limit_type in (
    'per_transaction_amount', 'daily_amount', 'monthly_amount', 'frequency_count'
  )),
  -- Utilisées par per_transaction_amount / daily_amount / monthly_amount.
  max_amount numeric(14, 2),
  -- Utilisées par frequency_count (nombre max d'opérations sur une
  -- fenêtre glissante de period_hours heures).
  max_count integer,
  period_hours integer,
  -- Dimensions de correspondance — NULL = joker, comme fee_rules.
  country text,
  currency text,
  kyc_status text check (kyc_status in ('unverified', 'pending', 'verified', 'rejected', 'requires_action')),
  provider text check (provider in ('orange', 'mtn', 'moov', 'wave', 'prepaid_card')),
  transaction_type text check (transaction_type in ('send', 'request')),
  user_tier text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (limit_type = 'frequency_count' and max_count is not null and period_hours is not null and max_amount is null)
    or
    (limit_type <> 'frequency_count' and max_amount is not null and max_count is null and period_hours is null)
  )
);

comment on table public.limit_rules is
  'Règles de limites configurables (Limit Engine, Prompt 11). NULL = joker sur cette dimension. Table intentionnellement vide au départ — aucune valeur de limite n''est documentée dans les sources du projet (voir docs/DECISIONS.md).';

create index if not exists limit_rules_active_type_idx on public.limit_rules (active, limit_type);

drop trigger if exists set_updated_at on public.limit_rules;
create trigger set_updated_at
  before update on public.limit_rules
  for each row execute function public.set_updated_at();

alter table public.limit_rules enable row level security;
-- Aucune policy cliente : lecture et écriture réservées au service_role
-- (pas d'UI Back Office de gestion des limites avant le Prompt 22).
