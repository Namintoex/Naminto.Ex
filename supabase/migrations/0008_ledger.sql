-- NAMINTO.EX — Financial Ledger (Prompt 12)
--
-- Référence : architecture générale section 31, Prompt 12. Le Ledger est
-- la source comptable de vérité — logique append-only stricte, en
-- partie double (chaque écriture équilibrée : somme des débits = somme
-- des crédits, par devise, pour un même lot d'écritures).
--
-- fee_payer est ajouté à transactions : le Ledger a besoin de savoir qui
-- paie le frais pour dériver le débit expéditeur / crédit destinataire
-- (voir docs/DECISIONS.md).

alter table public.transactions
  add column if not exists fee_payer text not null default 'sender'
    check (fee_payer in ('sender', 'recipient'));

comment on column public.transactions.fee_payer is
  'Qui paie le frais — déterminé par le Fee Engine (Prompt 10) au moment de la création. Utilisé par le Ledger (Prompt 12) pour dériver les écritures.';

-- ============================================================
-- 1. ledger_accounts — comptes internes du grand livre
-- ============================================================
create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in (
    'user_wallet', 'provider_suspense', 'fee_revenue', 'external_suspense'
  )),
  -- user_id pour owner_type = user_wallet, sinon NULL.
  owner_id uuid references auth.users (id) on delete set null,
  -- fournisseur pour owner_type = provider_suspense, sinon NULL.
  provider text check (provider in ('orange', 'mtn', 'moov', 'wave', 'prepaid_card')),
  currency text not null,
  created_at timestamptz not null default now()
);

comment on table public.ledger_accounts is
  'Comptes internes du grand livre (Prompt 12) — distincts de linked_accounts (Prompt 06, comptes fournisseurs externes de l''utilisateur).';

-- Un seul compte par combinaison (évite les doublons silencieux).
create unique index if not exists ledger_accounts_unique_idx
  on public.ledger_accounts (
    owner_type,
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(provider, ''),
    currency
  );

-- ============================================================
-- 2. ledger_entries — écritures append-only, en partie double
-- ============================================================
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id),
  account_id uuid not null references public.ledger_accounts (id),
  kind text not null check (kind in ('settlement', 'reversal', 'refund')),
  direction text not null check (direction in ('debit', 'credit')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null,
  reference text not null,
  created_at timestamptz not null default now()
);

comment on table public.ledger_entries is
  'Écritures append-only du grand livre. Aucune modification ni suppression possible, y compris par service_role (voir trigger forbid_ledger_entries_mutation) — toute correction produit une nouvelle écriture (kind=reversal/refund), jamais une réécriture.';

create index if not exists ledger_entries_transaction_id_idx on public.ledger_entries (transaction_id);
create index if not exists ledger_entries_account_id_idx on public.ledger_entries (account_id);

-- Immuabilité vérifiée au niveau base, pas seulement par l'absence de
-- policy RLS d'écriture cliente : même le service_role (qui contourne
-- RLS) ne peut pas modifier ou supprimer une écriture existante.
create or replace function public.forbid_ledger_entries_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ledger_entries est append-only : % interdit sur une écriture existante', tg_op;
end;
$$;

drop trigger if exists forbid_ledger_entries_update on public.ledger_entries;
create trigger forbid_ledger_entries_update
  before update on public.ledger_entries
  for each row execute function public.forbid_ledger_entries_mutation();

drop trigger if exists forbid_ledger_entries_delete on public.ledger_entries;
create trigger forbid_ledger_entries_delete
  before delete on public.ledger_entries
  for each row execute function public.forbid_ledger_entries_mutation();

alter table public.ledger_accounts enable row level security;
alter table public.ledger_entries enable row level security;

-- Un utilisateur peut consulter le solde de son propre portefeuille et
-- l'historique de ses propres écritures — jamais celles des autres, ni
-- les comptes système (provider_suspense, fee_revenue, external_suspense).
create policy "ledger_accounts_select_own_wallet"
  on public.ledger_accounts for select
  using (owner_type = 'user_wallet' and auth.uid() = owner_id);

create policy "ledger_entries_select_own"
  on public.ledger_entries for select
  using (
    exists (
      select 1 from public.ledger_accounts a
      where a.id = ledger_entries.account_id
        and a.owner_type = 'user_wallet'
        and a.owner_id = auth.uid()
    )
  );
-- Aucune policy insert/update/delete cliente : écriture exclusivement
-- via service_role (src/domains/payments/ledger/).
