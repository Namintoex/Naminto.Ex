# NAMINTO.EX — Journal des décisions

Format ADR (Architecture Decision Record) léger. Chaque décision liste son contexte, son statut et ses conséquences. Alimenté à chaque prompt du protocole `Les 30 prompts de vibecoding ultra-directifs`.

## ADR-001 — Dépôt git dédié et séparé

- **Date** : 2026-08-25
- **Contexte** : Naminto.Ex est un projet distinct de Naminto Académie ; les deux ne doivent jamais partager de code, dépôt ou configuration.
- **Décision** : dépôt git initialisé directement dans `D:\NAMINTO.EX VIBECODING`.
- **Statut** : Adopté.

## ADR-002 — Frontend Next.js 16 (App Router) + TypeScript

- **Date** : 2026-08-25
- **Contexte** : besoin d'une app web responsive (mobile/tablette/desktop/grands écrans), FR/EN, clair/sombre, avec intégration naturelle à Supabase (auth SSR, route handlers) et exigence explicite de zéro erreur TypeScript (Definition of Done du Master Prompt).
- **Décision** : Next.js 16 + TypeScript strict, App Router, ESLint, structure `src/`.
- **Alternative écartée** : React + Vite (SPA pure) — moins adapté à l'auth SSR et au routing back-office/user-app séparé prévu au Prompt 03.
- **Statut** : Adopté.
- **Conséquence** : `AGENTS.md` généré par Next.js 16 signale des changements par rapport aux versions antérieures — consulter `node_modules/next/dist/docs/` avant d'écrire du code spécifique à Next.js.

## ADR-003 — Gestionnaire de paquets npm

- **Date** : 2026-08-25
- **Contexte** : choix par défaut du scaffold, aucune contrainte contraire exprimée.
- **Décision** : npm (`package-lock.json` commité).
- **Statut** : Adopté.

## ADR-004 — Supabase comme backend/données

- **Date** : 2026-08-25
- **Contexte** : l'utilisateur confirme qu'un projet Supabase existe déjà pour Naminto.Ex, séparé de celui de Naminto Académie.
- **Décision** : Supabase (Postgres + Auth + Storage) sera le backend de données.
- **Statut** : Adopté en principe — **bloquant** : identifiants (URL, clés) à fournir avant le Prompt 04 (Identity), qui en dépend directement.

## ADR-005 — Pas d'implémentation CSS figée au scaffold initial

- **Date** : 2026-08-25
- **Contexte** : le Prompt 02 doit construire un Design System centralisé piloté par tokens (couleurs, typographie, spacing…). Figer un framework CSS dès le Prompt 01 risquerait de contraindre ce choix.
- **Décision** : scaffold Next.js créé sans Tailwind ; le choix de l'implémentation (Tailwind piloté par tokens, CSS Modules + tokens, ou autre) est différé au Prompt 02.
- **Statut** : Tranché à l'ADR-006 (Prompt 02).

## ADR-006 — Tailwind CSS v4 piloté par tokens CSS + class-variance-authority

- **Date** : 2026-08-25
- **Contexte** : le Design System (Prompt 02) doit exposer des tokens centralisés (couleurs, typographie, spacing, radius, shadows) réutilisables par tous les composants, avec support natif clair/sombre.
- **Décision** : Tailwind CSS v4 (config CSS-first via `@theme`), avec les tokens sémantiques définis comme variables CSS dans `globals.css` (`:root` / `.dark`) puis exposés à Tailwind. Les variantes de composants (Button, Badge, Alert…) utilisent `class-variance-authority` + `clsx`/`tailwind-merge` (helper `cn`).
- **Statut** : Adopté.
- **Conséquence** : toute évolution de la charte graphique se fait uniquement dans `src/app/globals.css` — aucune couleur ne doit être codée en dur dans les composants.

## ADR-007 — next-themes pour la gestion clair/sombre

- **Date** : 2026-08-25
- **Contexte** : besoin d'un thème clair/sombre persistant, sans flash de contenu non stylé (FOUC) au chargement.
- **Décision** : `next-themes` (stratégie `class` sur `<html>`), encapsulé dans `src/design-system/theme/theme-provider.tsx`.
- **Statut** : Adopté.

## ADR-008 — Radix UI comme primitives accessibles (Modal, Dropdown, Tabs)

- **Date** : 2026-08-25
- **Contexte** : la section 67 de l'architecture générale exige l'accessibilité (navigation clavier, lecteurs d'écran). Recoder à la main la gestion du focus, des portails et du clavier pour une modale/menu/onglets est risqué pour une application financière.
- **Décision** : `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-label`, `@radix-ui/react-slot` comme primitives headless, stylées avec les tokens du Design System.
- **Statut** : Adopté.

## ADR-009 — lucide-react comme bibliothèque d'icônes

- **Date** : 2026-08-25
- **Contexte** : aucune charte d'icônes propriétaire n'existe. Construire un set d'icônes custom sans direction artistique serait prématuré.
- **Décision** : `lucide-react` (icônes SVG, tree-shakeable, cohérentes avec un style « trait fin » adapté à un produit fintech premium).
- **Statut** : Adopté — remplaçable sans impact structurel si une charte d'icônes officielle est fournie plus tard.

## ADR-010 — i18n FR/EN : dictionnaire léger au Prompt 02, routing différé au Prompt 03

- **Date** : 2026-08-25
- **Contexte** : le Prompt 02 exige que le Design System « supporte FR/EN ». Une solution de routing i18n complète (ex. `next-intl` avec segments de locale) est une décision structurante qui recoupe le routing de l'Application Shell (Prompt 03, séparation USER APP / BACK OFFICE).
- **Décision** : pour le Prompt 02, un `LocaleProvider` léger (contexte React + dictionnaires `fr`/`en` dans `src/design-system/i18n/`) suffit à démontrer et tester chaque composant dans les deux langues. Le choix définitif de la solution de routing i18n pour l'ensemble de l'application est différé au Prompt 03.
- **Statut** : Adopté pour le Design System — **TODO_DECISION** pour l'i18n au niveau applicatif (voir tableau ci-dessous).

## TODO_DECISION en attente (issues des spécifications de domaine)

Ces points sont explicitement non définis dans les documents source. Ils ne doivent pas être devinés ; ils doivent être tranchés par l'utilisateur au moment où le prompt correspondant les rend bloquants.

| Domaine | Décision manquante |
|---|---|
| Identity | Durée de vie des sessions/tokens ; politique de complexité mot de passe/PIN ; fournisseur SMS ; critères exacts de détection « nouvel appareil » |
| User | Processus de changement de numéro de téléphone ; politique de changement du nom légal post-KYC ; portée réelle de la devise préférée |
| Payments | Barème complet des frais au-delà de 3,5 %/1000 FCFA ; durée d'expiration des demandes d'argent/QR ; politique de reversal auto vs manuel ; pays/devises additionnels |
| Audit | Durée de rétention des journaux par juridiction ; liste des actions à double validation ; plateforme de stockage |
| Observability | Plateforme d'observabilité retenue ; seuils d'alerte ; objectifs RTO/RPO |
| Technique (ce dépôt) | Framework de tests (Vitest/Jest) ; solution de routing i18n applicative (voir ADR-010) — à trancher au Prompt 03 |

Chaque nouveau `TODO_DECISION` rencontré pendant l'implémentation doit être ajouté à ce tableau plutôt que deviné.
