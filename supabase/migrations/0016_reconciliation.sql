-- NAMINTO.EX — Reconciliation Engine (Prompt 24)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Compare NAMINTO LEDGER (ledger_entries) vs PROVIDER (Provider Gateway,
-- Prompt 07) vs SETTLEMENT (transactions) — jamais une correction
-- silencieuse du Ledger (append-only, ADR-038) : ce moteur ne fait que
-- détecter et consigner une anomalie, sa résolution reste manuelle.

create table if not exists public.reconciliation_anomalies (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id),
  type text not null check (
    type in ('missing', 'duplicate', 'amount_mismatch', 'status_mismatch', 'settlement_mismatch')
  ),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'closed')),
  details jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reconciliation_anomalies is
  'Anomalies détectées par le Reconciliation Engine (Prompt 24) — cycle OPEN → INVESTIGATING → RESOLVED → CLOSED. `details` conserve les trois vues comparées (ledger/provider/settlement) au moment de la détection, jamais recalculées après coup. Aucune écriture vers ledger_entries/ledger_accounts n''est jamais déclenchée depuis ce domaine.';

create index if not exists reconciliation_anomalies_transaction_idx on public.reconciliation_anomalies (transaction_id);
create index if not exists reconciliation_anomalies_open_idx on public.reconciliation_anomalies (status) where status in ('open', 'investigating');

drop trigger if exists set_updated_at on public.reconciliation_anomalies;
create trigger set_updated_at
  before update on public.reconciliation_anomalies
  for each row execute function public.set_updated_at();

alter table public.reconciliation_anomalies enable row level security;
-- Aucune policy cliente : lecture et écriture réservées à service_role (Back Office, permission reconciliation.*).
