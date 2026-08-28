-- NAMINTO.EX — Security Audit (Prompt 28)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Corrige, au niveau base de données, les races condition confirmées par
-- l'audit offensif (voir docs/DECISIONS.md ADR-056) : chaque correctif
-- ci-dessous remplace un cycle lecture-puis-écriture (TOCTOU) par une
-- opération atomique unique — jamais une simple journalisation du
-- problème.

-- ============================================================
-- 1. Bootstrap RBAC atomique (privilege escalation — deux comptes
--    pourraient sinon devenir super_admin simultanément sur un projet
--    fraîchement migré : le SELECT count()=0 et l'INSERT qui suit
--    n'étaient pas atomiques l'un par rapport à l'autre).
-- ============================================================
create or replace function public.bootstrap_super_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verrou consultatif transactionnel : sérialise tous les appels
  -- concurrents à cette fonction (relâché automatiquement à la fin de
  -- la transaction), y compris quand la table est encore vide et
  -- qu'aucune ligne n'existe donc à verrouiller.
  perform pg_advisory_xact_lock(hashtext('bootstrap_super_admin'));

  if exists (select 1 from public.admin_role_assignments) then
    return false;
  end if;

  insert into public.admin_role_assignments (user_id, role) values (p_user_id, 'super_admin');
  return true;
end;
$$;

comment on function public.bootstrap_super_admin is
  'Attribution atomique de super_admin au tout premier compte qui accède à /admin sur un projet vide (Prompt 23/28) — remplace le SELECT count()=0 + INSERT non atomiques de getUserRoles.';

-- ============================================================
-- 2. Verrouillage PIN atomique (brute force — le cycle lecture de
--    failed_attempts puis écriture de attempts+1 permettait à des
--    tentatives concurrentes de toutes lire la même valeur non à jour,
--    empêchant le verrouillage de jamais se déclencher).
-- ============================================================
create or replace function public.increment_pin_failed_attempts(
  p_user_id uuid,
  p_max_attempts int,
  p_lockout_minutes int
)
returns table(attempts int, locked boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_locked_until timestamptz;
begin
  -- L'UPDATE avec incrémentation calculée côté SQL verrouille la ligne
  -- pour la durée de la transaction : un appel concurrent pour le même
  -- utilisateur attend la fin de celui-ci avant de lire/incrémenter à
  -- son tour, donc toujours à partir de la valeur réellement à jour.
  update public.pin_credentials
  set failed_attempts = pin_credentials.failed_attempts + 1
  where user_id = p_user_id
  returning pin_credentials.failed_attempts into v_attempts;

  if v_attempts is null then
    return;
  end if;

  if v_attempts >= p_max_attempts then
    v_locked_until := now() + (p_lockout_minutes || ' minutes')::interval;
    update public.pin_credentials
    set failed_attempts = 0, locked_until = v_locked_until
    where user_id = p_user_id;
    return query select 0, true, v_locked_until;
  else
    return query select v_attempts, false, null::timestamptz;
  end if;
end;
$$;

comment on function public.increment_pin_failed_attempts is
  'Incrémentation atomique du compteur d''échecs PIN (Prompt 04/28) — un burst de requêtes concurrentes ne peut plus jamais réinitialiser silencieusement le compteur en lisant tous la même valeur avant l''écriture.';

-- ============================================================
-- 3. Verrouillage anti-brute-force sur la connexion (email + mot de
--    passe) — jusqu'ici aucune protection applicative, seulement les
--    réglages par défaut de Supabase Auth. Clé par hash d'email (jamais
--    lié à auth.users) : couvre aussi les tentatives contre une adresse
--    inexistante, pas seulement les comptes réels.
-- ============================================================
create table if not exists public.login_attempts (
  email_hash text primary key,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.login_attempts is
  'Anti-brute-force sur la connexion (Prompt 28) — clé par hash SHA-256 de l''adresse e-mail, jamais l''adresse en clair, jamais liée à auth.users (couvre aussi les tentatives contre un compte inexistant). Aucune policy cliente : service_role uniquement.';

alter table public.login_attempts enable row level security;

create or replace function public.record_login_failure(
  p_email_hash text,
  p_max_attempts int,
  p_lockout_minutes int
)
returns table(attempts int, locked boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_locked_until timestamptz;
begin
  -- INSERT ... ON CONFLICT DO UPDATE est une seule opération atomique :
  -- deux tentatives concurrentes pour le même e-mail se sérialisent sur
  -- le verrou de ligne implicite de l'upsert, jamais sur une lecture
  -- préalable non à jour.
  insert into public.login_attempts (email_hash, failed_attempts)
  values (p_email_hash, 1)
  on conflict (email_hash) do update
    set failed_attempts = login_attempts.failed_attempts + 1, updated_at = now()
  returning login_attempts.failed_attempts into v_attempts;

  if v_attempts >= p_max_attempts then
    v_locked_until := now() + (p_lockout_minutes || ' minutes')::interval;
    update public.login_attempts
    set failed_attempts = 0, locked_until = v_locked_until
    where email_hash = p_email_hash;
    return query select 0, true, v_locked_until;
  else
    return query select v_attempts, false, null::timestamptz;
  end if;
end;
$$;

comment on function public.record_login_failure is
  'Incrémentation atomique du compteur d''échecs de connexion (Prompt 28), même mécanisme que increment_pin_failed_attempts.';

-- ============================================================
-- 4. Idempotence réelle du Ledger au niveau base (duplicate payment —
--    recordSettlement/recordReversal/recordRefund vérifiaient
--    l'existence puis écrivaient sans aucune contrainte unique pour
--    rattraper une course : deux appels concurrents pouvaient tous deux
--    passer la vérification et produire un double lot d'écritures).
-- ============================================================
create table if not exists public.ledger_settlement_claims (
  transaction_id uuid not null references public.transactions (id),
  kind text not null check (kind in ('settlement', 'reversal', 'refund')),
  claimed_at timestamptz not null default now(),
  primary key (transaction_id, kind)
);

comment on table public.ledger_settlement_claims is
  'Verrou d''exclusivité (Prompt 28) pour l''écriture d''un lot d''écritures Ledger — un seul appelant peut jamais réclamer (transaction_id, kind) : la clé primaire fait office de contrainte d''unicité, contrairement à ledger_entries qui contient plusieurs lignes légitimes par (transaction_id, kind) et ne peut donc pas porter cette contrainte directement. Jamais lue/écrite en dehors de record-entries.ts.';

alter table public.ledger_settlement_claims enable row level security;
-- Aucune policy cliente sur login_attempts / ledger_settlement_claims : service_role uniquement.

-- ============================================================
-- 5. Réclamation atomique d'une demande d'argent (duplicate payment /
--    replay — deux payeurs concurrents pouvaient tous deux dépasser la
--    vérification de statut "pending" et faire progresser la MÊME
--    transaction, l'un authentifiant son propre PIN pendant que
--    l'écriture Ledger débitait en réalité le portefeuille de l'autre).
-- ============================================================
alter table public.money_requests
  add column if not exists claimed_by_user_id uuid references auth.users (id) on delete set null;

comment on column public.money_requests.claimed_by_user_id is
  'Réclamation atomique (Prompt 28) — posée par une UPDATE conditionnelle (status=pending AND (claimed_by_user_id IS NULL OR = payeur)) avant tout appel à l''orchestrateur : un seul payeur concurrent peut jamais gagner la réclamation, les autres sont rejetés avant même de saisir leur PIN.';

create index if not exists money_requests_claimed_by_idx
  on public.money_requests (claimed_by_user_id)
  where claimed_by_user_id is not null;

-- ============================================================
-- 6. Restriction en écriture de notifications à la seule colonne
--    read_at (permissions insuffisantes — la policy RLS
--    notifications_update_own autorisait déjà uniquement les lignes du
--    titulaire, mais aucune restriction de colonne : un titulaire
--    pouvait en théorie réécrire le titre/corps de ses propres
--    notifications via un appel direct à l'API Supabase, jamais depuis
--    ce dépôt mais atteignable par un client tiers avec son propre JWT).
-- ============================================================
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
