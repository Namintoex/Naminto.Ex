-- NAMINTO.EX — Send Money (Prompt 13)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Référence : PAYMENTS — Spécification Markdown.docx (parcours Send
-- Money), docs/DECISIONS.md ADR-041.
--
-- destination_reference (0005_transactions.sql) est un uuid référençant
-- linked_accounts — adapté uniquement à destination_type = 'linked_account'.
-- Un bénéficiaire externe (destination_type = 'external') n'a pas de ligne
-- linked_accounts (Naminto.Ex ne connaît pas ses comptes) : sa référence
-- (ex. numéro de téléphone) est donc un texte libre, distinct de
-- destination_reference plutôt qu'une réutilisation incompatible du type.

alter table public.transactions
  add column if not exists destination_external_reference text;

comment on column public.transactions.destination_external_reference is
  'Référence du bénéficiaire externe (ex. numéro de téléphone) quand destination_type = external — distinct de destination_reference (uuid, réservé aux comptes liés). Renseigné par Send Money (Prompt 13).';
