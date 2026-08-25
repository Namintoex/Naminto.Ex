-- NAMINTO.EX — Correction : permettre la reconnexion d'un compte délié (Prompt 06)
--
-- La contrainte unique initiale (0003) bloquait toute nouvelle liaison
-- avec la même référence après déliaison, alors que "reconnexion" fait
-- explicitement partie du périmètre du Prompt 06. On la remplace par un
-- index unique partiel qui ignore les lignes déliées.

alter table public.linked_accounts
  drop constraint if exists linked_accounts_user_id_provider_external_reference_key;

create unique index if not exists linked_accounts_active_unique
  on public.linked_accounts (user_id, provider, external_reference)
  where status <> 'unlinked';
