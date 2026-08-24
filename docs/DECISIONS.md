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
- **Statut** : Ouvert — à trancher au Prompt 02.

## TODO_DECISION en attente (issues des spécifications de domaine)

Ces points sont explicitement non définis dans les documents source. Ils ne doivent pas être devinés ; ils doivent être tranchés par l'utilisateur au moment où le prompt correspondant les rend bloquants.

| Domaine | Décision manquante |
|---|---|
| Identity | Durée de vie des sessions/tokens ; politique de complexité mot de passe/PIN ; fournisseur SMS ; critères exacts de détection « nouvel appareil » |
| User | Processus de changement de numéro de téléphone ; politique de changement du nom légal post-KYC ; portée réelle de la devise préférée |
| Payments | Barème complet des frais au-delà de 3,5 %/1000 FCFA ; durée d'expiration des demandes d'argent/QR ; politique de reversal auto vs manuel ; pays/devises additionnels |
| Audit | Durée de rétention des journaux par juridiction ; liste des actions à double validation ; plateforme de stockage |
| Observability | Plateforme d'observabilité retenue ; seuils d'alerte ; objectifs RTO/RPO |
| Technique (ce dépôt) | Framework de tests (Vitest/Jest) ; implémentation CSS du Design System (ADR-005) |

Chaque nouveau `TODO_DECISION` rencontré pendant l'implémentation doit être ajouté à ce tableau plutôt que deviné.
