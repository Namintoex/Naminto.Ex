-- NAMINTO.EX — Domaine User (Prompt 05)
-- Étend identity_profiles (créé au Prompt 04) plutôt que de dupliquer un
-- second système : KYC, devise préférée, préférences de notification.
--
-- Référence : USER — Spécification Markdown.docx, Prompt 05 (KYC Foundation).

-- ============================================================
-- 1. Colonnes ajoutées à identity_profiles
-- ============================================================
alter table public.identity_profiles
  add column if not exists kyc_status text not null default 'unverified'
    check (kyc_status in ('unverified', 'pending', 'verified', 'rejected', 'requires_action')),
  add column if not exists preferred_currency text not null default 'XOF',
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists sound_enabled boolean not null default true;

comment on column public.identity_profiles.kyc_status is
  'Statut KYC affiché — produit par le futur domaine Compliance. Jamais modifiable par le client (voir trigger protect_privileged_identity_columns).';
comment on column public.identity_profiles.preferred_currency is
  'Devise préférée (affichage uniquement pour l''instant — lancement FCFA/XOF, multi-devises prévu au Prompt 29).';

-- ============================================================
-- 2. Protection des colonnes privilégiées
-- ============================================================
-- La policy "identity_profiles_update_own" autorise la mise à jour de
-- toute la ligne par son titulaire. Ce trigger empêche spécifiquement la
-- modification de kyc_status / status / phone_verified par un rôle autre
-- que service_role, quelle que soit la policy RLS en place.
create or replace function public.protect_privileged_identity_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.kyc_status is distinct from old.kyc_status then
      raise exception 'kyc_status ne peut être modifié que par le service_role';
    end if;
    if new.status is distinct from old.status then
      raise exception 'status ne peut être modifié que par le service_role';
    end if;
    if new.phone_verified is distinct from old.phone_verified then
      raise exception 'phone_verified ne peut être modifié que par le service_role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_identity_columns on public.identity_profiles;
create trigger protect_privileged_identity_columns
  before update on public.identity_profiles
  for each row execute function public.protect_privileged_identity_columns();
