-- NAMINTO.EX — RBAC (Prompt 23)
-- À exécuter dans l'éditeur SQL du projet Supabase de Naminto.Ex
-- (jamais celui de Naminto Académie).
--
-- Ferme le TODO_DECISION bloquant explicitement documenté depuis le
-- Prompt 22 (ADR-016) : /admin n'était protégé que par authentification,
-- n'importe quel compte Naminto.Ex pouvait y accéder.

create table if not exists public.admin_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (
    role in ('support', 'kyc', 'compliance', 'risk', 'finance', 'operations', 'security', 'legal', 'super_admin')
  ),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

comment on table public.admin_role_assignments is
  'Rôles Back Office (Prompt 23) — infrastructure de sécurité pure : aucune policy cliente, même pour le titulaire (comme security_events). Le tout premier accès à /admin sur un projet sans aucune ligne ici s''auto-attribue super_admin (bootstrap, voir src/domains/rbac/queries.ts) ; ensuite, seul un super_admin peut attribuer des rôles.';

create index if not exists admin_role_assignments_user_idx on public.admin_role_assignments (user_id);

alter table public.admin_role_assignments enable row level security;
-- Aucune policy cliente : lecture et écriture réservées à service_role.
