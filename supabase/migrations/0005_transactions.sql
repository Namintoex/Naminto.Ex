-- NAMINTO.EX — Domain Transaction (Prompt 08)
--
-- Référence : PAYMENTS — Spécification Markdown.docx (State Machine),
-- docs/ARCHITECTURE.md section Payments, Prompt 08.
--
-- Aucune écriture cliente n'est autorisée sur ces deux tables (aucune
-- policy INSERT/UPDATE/DELETE) : la création et les transitions de
-- statut passent exclusivement par le service applicatif
-- src/domains/payments/transactions.ts (client service_role), qui
-- applique la State Machine avant toute écriture. Le trigger ci-dessous
-- rejoue la même validation côté base, en défense en profondeur.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  idempotency_key text not null unique,
  sender_user_id uuid references auth.users (id) on delete set null,
  recipient_user_id uuid references auth.users (id) on delete set null,
  source_type text not null check (source_type in ('naminto_wallet', 'linked_account')),
  source_reference uuid references public.linked_accounts (id) on delete set null,
  destination_type text not null check (destination_type in ('naminto_wallet', 'linked_account', 'external')),
  destination_reference uuid references public.linked_accounts (id) on delete set null,
  provider text check (provider in ('orange', 'mtn', 'moov', 'wave', 'prepaid_card')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  fee numeric(14, 2) not null default 0 check (fee >= 0),
  total numeric(14, 2) not null,
  status text not null default 'created' check (status in (
    'created', 'validating', 'authentication_required', 'authenticated',
    'processing', 'provider_confirmed', 'settled', 'failed', 'rejected',
    'expired', 'cancelled', 'reversed', 'refunded', 'disputed'
  )),
  provider_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.transactions is
  'Modèle Transaction central (Prompt 08). Écriture exclusivement via src/domains/payments/transactions.ts (service_role) — jamais depuis le client.';

create table if not exists public.transaction_status_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.transaction_status_events is
  'Historique append-only de chaque transition de statut — traçabilité (architecture générale, section 2.7).';

create index if not exists transactions_sender_idx on public.transactions (sender_user_id);
create index if not exists transactions_recipient_idx on public.transactions (recipient_user_id);
create index if not exists transaction_status_events_transaction_id_idx on public.transaction_status_events (transaction_id);

drop trigger if exists set_updated_at on public.transactions;
create trigger set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ============================================================
-- Défense en profondeur : la State Machine est revalidée côté base.
-- Doit rester le miroir exact de src/domains/payments/transaction-status.ts.
-- ============================================================
create or replace function public.check_transaction_status_transition()
returns trigger
language plpgsql
as $$
declare
  allowed boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'created' then new.status in ('validating')
    when 'validating' then new.status in ('authentication_required', 'failed', 'rejected')
    when 'authentication_required' then new.status in ('authenticated', 'expired', 'cancelled')
    when 'authenticated' then new.status in ('processing')
    when 'processing' then new.status in ('provider_confirmed', 'failed', 'expired')
    when 'provider_confirmed' then new.status in ('settled')
    when 'settled' then new.status in ('reversed', 'refunded', 'disputed')
    else false
  end;

  if not allowed then
    raise exception 'Transition de transaction invalide : % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists check_transaction_status_transition on public.transactions;
create trigger check_transaction_status_transition
  before update on public.transactions
  for each row execute function public.check_transaction_status_transition();

alter table public.transactions enable row level security;
alter table public.transaction_status_events enable row level security;

-- Lecture seule pour l'expéditeur et le destinataire — aucune écriture
-- cliente (pas de policy insert/update/delete : service_role uniquement).
create policy "transactions_select_participant"
  on public.transactions for select
  using (auth.uid() = sender_user_id or auth.uid() = recipient_user_id);

create policy "transaction_status_events_select_participant"
  on public.transaction_status_events for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_status_events.transaction_id
        and (auth.uid() = t.sender_user_id or auth.uid() = t.recipient_user_id)
    )
  );
