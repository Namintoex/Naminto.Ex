-- NAMINTO.EX — Corrige l'index unique de ledger_accounts (nettoyage post-lancement)
--
-- ledger_accounts_unique_idx (0008_ledger.sql) force tous les owner_id
-- NULL d'un même (owner_type, provider, currency) à entrer en collision
-- via coalesce(owner_id, sentinel) — voulu pour les comptes système
-- (fee_revenue/provider_suspense/external_suspense, owner_id toujours
-- NULL par construction), jamais anticipé pour user_wallet.
--
-- Un wallet user_wallet ne devient owner_id = NULL que par effet de
-- bord de ON DELETE SET NULL (auth.users supprimé). Une fois UN
-- utilisateur supprimé, son ancien wallet orphelin occupe seul la
-- collision (owner_type='user_wallet', NULL, '', currency) — et comme
-- cet orphelin reste référencé par de vraies ledger_entries (jamais
-- supprimables, ADR-038), toute suppression suivante d'un autre
-- utilisateur ayant un wallet dans la même devise échoue
-- indéfiniment sur cette même collision.
--
-- Remplace l'index unique par deux index distincts : un pour les
-- comptes système (comportement inchangé), un pour les wallets qui ne
-- s'applique que lorsque owner_id n'est pas NULL — les orphelins
-- (owner_id NULL) redeviennent chacun distincts, comme le veut la
-- sémantique standard de Postgres pour NULL dans un index unique.
-- Aucune ligne ledger_entries n'est jamais touchée.

drop index if exists public.ledger_accounts_unique_idx;

create unique index if not exists ledger_accounts_system_unique_idx
  on public.ledger_accounts (owner_type, coalesce(provider, ''), currency)
  where owner_type <> 'user_wallet';

create unique index if not exists ledger_accounts_user_wallet_unique_idx
  on public.ledger_accounts (owner_type, owner_id, currency)
  where owner_type = 'user_wallet' and owner_id is not null;
