-- NAMINTO.EX — Fee Engine (Prompt 10)
--
-- Référence : architecture générale sections 27-28, Prompt 10. Chaque
-- règle peut dépendre de country/currency/amount/source/destination/
-- provider/transaction_type/user_tier — un champ NULL signifie
-- « n'importe lequel » (joker). La règle la plus spécifique qui
-- correspond à la requête est retenue (voir
-- src/domains/payments/fee-engine/pick-rule.ts).
--
-- Aucune règle tarifaire n'est codée en dur dans l'UI ni dans le cœur
-- financier : tout passe par cette table, gérée pour l'instant en
-- service_role (pas encore d'interface Back Office — Prompt 22).

create table if not exists public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  country text,
  currency text,
  min_amount numeric(14, 2),
  max_amount numeric(14, 2),
  source_type text check (source_type in ('naminto_wallet', 'linked_account')),
  destination_type text check (destination_type in ('naminto_wallet', 'linked_account', 'external')),
  provider text check (provider in ('orange', 'mtn', 'moov', 'wave', 'prepaid_card')),
  transaction_type text check (transaction_type in ('send', 'request')),
  user_tier text,
  rate_percent numeric(6, 4) not null check (rate_percent >= 0),
  flat_fee numeric(14, 2) not null default 0 check (flat_fee >= 0),
  fee_payer text not null default 'sender' check (fee_payer in ('sender', 'recipient')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);

comment on table public.fee_rules is
  'Règles de tarification configurables (Fee Engine, Prompt 10). NULL = joker sur cette dimension. La règle la plus spécifique qui correspond à la requête est appliquée.';

create index if not exists fee_rules_active_idx on public.fee_rules (active);

drop trigger if exists set_updated_at on public.fee_rules;
create trigger set_updated_at
  before update on public.fee_rules
  for each row execute function public.set_updated_at();

alter table public.fee_rules enable row level security;
-- Aucune policy cliente : lecture et écriture réservées au service_role
-- pour l'instant (pas d'UI Back Office de tarification avant le Prompt 22).

-- Règle de repli initiale, reprenant le seul taux documenté à ce jour
-- (architecture générale, section 27 : 3,5 % pour 1 000 FCFA). Un seul
-- joker levé (currency) : c'est la règle la moins spécifique possible,
-- qui ne s'applique que si aucune règle plus ciblée n'existe.
insert into public.fee_rules (currency, rate_percent, flat_fee, fee_payer)
select 'XOF', 0.035, 0, 'sender'
where not exists (
  select 1 from public.fee_rules
  where currency = 'XOF'
    and country is null and min_amount is null and max_amount is null
    and source_type is null and destination_type is null
    and provider is null and transaction_type is null and user_tier is null
);
