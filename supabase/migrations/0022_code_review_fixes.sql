-- NAMINTO.EX — Corrections issues d'une revue de code complète avant
-- publication sur GitHub (non liée à un prompt du protocole des 30
-- prompts, effectuée après le Prompt 30).
--
-- 1. devices : la policy RLS `devices_update_own` autorisait la mise à
--    jour de N'IMPORTE QUELLE colonne des appareils d'un titulaire, alors
--    que le seul chemin client réel (revokeDeviceAction) ne modifie que
--    `status`. Un JWT encore valide pour un appareil que le titulaire
--    vient de révoquer pouvait donc annuler sa propre révocation via un
--    appel direct à l'API REST Supabase. Même correctif déjà appliqué à
--    `notifications` (migration 0020_security_audit.sql, constat #10).
revoke update on public.devices from authenticated;
grant update (status) on public.devices to authenticated;

-- 2. webhook_events : `findExistingProcessedEvent` (SELECT) puis
--    `insertAuditRow` (INSERT status='processed') n'étaient pas
--    atomiques — deux livraisons vraiment concurrentes du même
--    event_id (un fournisseur qui double-livre son propre webhook)
--    pouvaient toutes deux passer la vérification de duplication et
--    produire deux lignes `processed` pour le même événement.
--    Index unique PARTIEL (pas une contrainte pleine table, pour ne
--    jamais bloquer un rejeu Back Office légitime — replay.ts pose
--    toujours `replay_of`, donc les lignes de rejeu restent hors de cet
--    index) : seules les lignes `processed` ET `replay_of is null`
--    (une livraison entrante normale, jamais un rejeu) doivent être
--    uniques par (provider, event_id).
create unique index if not exists webhook_events_processed_original_unique_idx
  on public.webhook_events (provider, event_id)
  where status = 'processed' and replay_of is null;
