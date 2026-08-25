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

## ADR-011 — Application Shell : séparation par arborescence de routes, i18n applicatif sans préfixe d'URL

- **Date** : 2026-08-25
- **Contexte** : le Prompt 03 exige que USER APP et BACK OFFICE soient « structurellement séparés », et fournit une liste de routes principales à créer.
- **Décision** :
  - Séparation via l'arborescence Next.js : l'espace utilisateur vit dans le groupe de routes `src/app/(user)/` (racine `/`, ex. `/send`, `/history`…) ; le Back Office vit sous le segment réel `src/app/admin/` (préfixe `/admin/...`), chacun avec son propre `layout.tsx`.
  - Un seul composant `Shell` (`src/shell/shell.tsx`), paramétré par `variant: "user" | "admin"`, compose Header + Sidebar + navigation mobile pour les deux espaces — évite de dupliquer un composant pour deux usages quasi identiques (cf. règle Prompt 02 « ne duplique aucun composant »).
  - i18n : on conserve le `LocaleProvider` léger du Prompt 02, maintenant utilisé pour toute l'application (persistance via `localStorage`, lu de façon hydration-safe avec `useSyncExternalStore`). Pas de préfixe de locale dans l'URL (`/fr/...`, `/en/...`) : aucune spécification n'exige de SEO multilingue ni d'URLs localisées à ce stade, et une solution de routing complète (ex. `next-intl`) resterait à réévaluer si ce besoin apparaît.
  - Toutes les routes principales (10 côté utilisateur, 17 côté Back Office) sont créées avec un état « Bientôt disponible » via un composant `ComingSoonPage` partagé, conformément au Prompt 03. Le tableau de bord utilisateur (`/`) est lui aussi à l'état « Bientôt disponible » — aucune donnée financière n'est simulée, conformément à « Ne mets aucune logique financière dans le shell ».
- **Statut** : Adopté. Referme le TODO_DECISION i18n applicatif ouvert par l'ADR-010.
- **Conséquence** : passer les tableaux de navigation (icônes Lucide, composants fonctions) d'un Server Component vers `Shell` (Client Component) échoue à la sérialisation RSC — `Shell` importe donc directement `userNavItems`/`adminNavItems` en interne plutôt que de les recevoir en props depuis les layouts.

## ADR-012 — Sheet (panneau latéral) ajouté au Design System pour la navigation mobile

- **Date** : 2026-08-25
- **Contexte** : le Prompt 03 exige une navigation mobile dédiée. La barre d'onglets basse ne peut afficher que 4 éléments primaires ; le reste du menu doit être accessible via un panneau.
- **Décision** : ajout de `Sheet`/`SheetContent` (`src/design-system/components/sheet.tsx`) au Design System, construit sur `@radix-ui/react-dialog` (même primitive que `Modal`, avec positionnement latéral). Réutilisé par `MobileNav` pour afficher la liste complète des liens.
- **Statut** : Adopté.

## ADR-004bis — Identifiants Supabase reçus et projet connecté

- **Date** : 2026-08-25
- **Contexte** : suite de l'ADR-004, bloquante avant le Prompt 04.
- **Décision** : URL, clé publique (`sb_publishable_...`) et clé secrète (`sb_secret_...`) du projet Supabase de Naminto.Ex reçues et renseignées dans `.env.local` (non commité). Connexion Postgres directe testée : le sous-domaine `db.<ref>.supabase.co` ne se résout pas depuis cet environnement de développement (limitation réseau locale, probablement IPv6 requis) — la **Session Pooler** (`aws-1-eu-west-1.pooler.supabase.com`, IPv4) fonctionne et est utilisée pour les migrations exécutées depuis l'environnement de dev.
- **Statut** : Adopté.
- **Conséquence** : si une exécution future de migration échoue avec `ENOTFOUND db.*.supabase.co`, utiliser la chaîne Session Pooler plutôt que la connexion directe.

## ADR-013 — Authentification : Supabase Auth (email + mot de passe) + tables custom pour PIN/appareils/audit

- **Date** : 2026-08-25
- **Contexte** : Prompt 04 (Identity). Éviter de réinventer une couche d'authentification pour un produit financier (cf. Prompt 30 vibecoding : « ne code aucune authentification fictive »).
- **Décision** :
  - Supabase Auth gère l'inscription, la connexion, le mot de passe et les sessions (email + mot de passe pour l'instant — voir ADR-014 pour le téléphone/SMS).
  - Le PIN Naminto.Ex, les appareils et l'historique de sécurité vivent dans des tables Postgres custom (`supabase/migrations/0001_identity.sql` : `identity_profiles`, `pin_credentials`, `devices`, `security_events`), reliées à `auth.users.id`.
  - `pin_credentials` n'a **aucune policy RLS de lecture**, y compris pour le titulaire : le hash du PIN ne quitte jamais la base, la vérification passe toujours par un Route Handler / Server Action utilisant le client `service_role` (`src/lib/supabase/admin.ts`, protégé par le paquet `server-only`).
  - `security_events` est en lecture seule pour l'utilisateur (RLS `select` uniquement) — toute écriture passe par `service_role` (`src/domains/identity/security-events.ts`), pour qu'aucun utilisateur ne puisse forger son propre historique.
  - PIN : 6 chiffres, haché avec `bcryptjs` (12 rounds), verrouillage après 5 échecs pendant 15 minutes (`src/domains/identity/pin.ts`).
  - Identifiant d'appareil : cookie httpOnly opaque (`nx_device_id`, UUID aléatoire) plutôt qu'un fingerprinting technique (canvas, user-agent complet) — conforme au principe de privacy by design (section 65 de l'architecture).
- **Statut** : Adopté.

## ADR-014 — Téléphone/SMS : différé, e-mail comme identifiant principal pour l'instant

- **Date** : 2026-08-25
- **Contexte** : le parcours d'inscription de référence prévoit une confirmation par SMS. Cela nécessite un fournisseur SMS payant (Twilio, MessageBird…) configuré dans Supabase, pas encore en place.
- **Décision** : l'inscription utilise e-mail + mot de passe (confirmation par e-mail via le mailer intégré de Supabase, fonctionnel sans configuration supplémentaire). Le numéro de téléphone reste un champ du profil (`identity_profiles.phone_number`), non vérifié (`phone_verified = false`), collecté mais inactif.
- **Statut** : Adopté temporairement — **TODO_DECISION** : activer le flux téléphone + OTP SMS une fois un fournisseur configuré (voir tableau ci-dessous).
- **Conséquence** : `public.identity_profiles.phone_verified` reste à `false` pour tous les comptes tant que ce point n'est pas traité ; ne pas construire de logique dépendant d'un numéro vérifié avant cette activation.

## ADR-015 — Confirmation e-mail et réinitialisation de mot de passe via `/auth/confirm`

- **Date** : 2026-08-25
- **Contexte** : Supabase Auth exige par défaut la confirmation de l'adresse e-mail avant qu'une session soit créée (vérifié empiriquement : `signUp()` renvoie `session: null` tant que le lien n'est pas cliqué).
- **Décision** : Route Handler unique `src/app/auth/confirm/route.ts` gérant `token_hash` + `type` (`supabase.auth.verifyOtp`), utilisé à la fois pour la confirmation d'inscription et la réinitialisation de mot de passe, avec un paramètre `next` pour la redirection post-vérification. C'est le pattern actuellement documenté par Supabase pour Next.js App Router.
- **Statut** : Adopté.
- **⚠️ Dépendance externe non vérifiable depuis le code** : ce mécanisme suppose que le modèle d'e-mail Supabase (Dashboard > Authentication > Email Templates) pointe vers `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=...`. Si les modèles par défaut de ce projet utilisent encore l'ancien format (`{{ .ConfirmationURL }}` pointant vers la page hébergée par Supabase), la confirmation fonctionnera probablement quand même (Supabase redirige ensuite vers `redirectTo`), mais à vérifier lors du premier test réel avec un vrai fournisseur d'e-mail. Non testable en profondeur depuis cet environnement (voir Definition of Done ci-dessous).

## ADR-016 — `/admin` protégé par authentification seule, RBAC différé au Prompt 23

- **Date** : 2026-08-25
- **Contexte** : le Prompt 04 ne couvre que Identity, pas les rôles (Prompt 23). Le Back Office ne doit pourtant pas rester totalement ouvert.
- **Décision** : `src/proxy.ts` (ex-`middleware.ts`, renommé selon la convention Next.js 16 — voir Conséquence) exige une session valide pour accéder à `/admin/*`, exactement comme pour l'espace utilisateur. **Aucune vérification de rôle n'existe encore** : n'importe quel compte Naminto.Ex authentifié peut actuellement accéder au Back Office.
- **Statut** : Adopté comme mesure temporaire — **TODO_DECISION bloquant avant mise en production** : RBAC (Prompt 23) doit restreindre `/admin` aux rôles Support/KYC/Compliance/Risk/Finance/Operations/Security/Legal/Super Admin.
- **Conséquence** : `src/middleware.ts` renommé en `src/proxy.ts` (export `proxy` au lieu de `middleware`) — Next.js 16 a déprécié la convention `middleware`. Migration effectuée via lecture de `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

## ADR-017 — User étend identity_profiles plutôt qu'une table séparée

- **Date** : 2026-08-25
- **Contexte** : Prompt 05 (User Profile + KYC Foundation). La documentation d'architecture (section 68) présente Identity et User comme deux domaines distincts, et la spécification USER envisageait initialement une table `UserProfile` séparée.
- **Décision** : `identity_profiles` (créée au Prompt 04) est étendue par `supabase/migrations/0002_user_profile.sql` (`kyc_status`, `preferred_currency`, `notifications_enabled`, `sound_enabled`) plutôt que de créer une seconde table faisant doublon. Identity et User restent deux bounded contexts au niveau du **code** (`src/domains/identity/` vs `src/domains/user/`, requêtes et Server Actions séparées), mais partagent la même table racine — conforme à la règle du Master Prompt « ne crée jamais un deuxième système qui fait la même chose » et à la phrase de l'architecture générale : « L'identité Naminto.Ex constitue la racine de toutes les fonctionnalités personnelles ».
- **Statut** : Adopté.

## ADR-018 — KYC : colonnes protégées par trigger, jamais auto-attribuables

- **Date** : 2026-08-25
- **Contexte** : le Prompt 05 exige de préparer le modèle KYC sans prétendre à une vérification réelle, et d'ajouter permissions/audit. La policy RLS `identity_profiles_update_own` (Prompt 04) autorise la mise à jour de toute la ligne par son titulaire — un risque si `kyc_status` restait dans son périmètre.
- **Décision** : trigger `protect_privileged_identity_columns` (fonction `SECURITY INVOKER`, vérifie `auth.role()`) rejette toute tentative de modification de `kyc_status`, `status` ou `phone_verified` par un rôle autre que `service_role`, quelle que soit la policy RLS. Le badge KYC affiché dans `/settings` est donc purement informatif — aucune action de vérification n'existe encore côté produit (fournisseur externe à intégrer plus tard, hors périmètre de ce prompt).
- **Statut** : Adopté.
- **Vérifié empiriquement** : appel `PATCH` direct à l'API REST Supabase (`Authorization: Bearer <token utilisateur>`) tentant de passer `kyc_status` à `verified` → rejeté avec l'erreur du trigger (HTTP 400, `P0001`).

## ADR-019 — Préférences de langue/devise stockées mais non branchées sur l'UI live

- **Date** : 2026-08-25
- **Contexte** : le Prompt 05 demande que le profil « puisse contenir » langue et devise préférées. Le `LocaleProvider` (Prompt 02/03) pilote déjà la langue de l'interface via `localStorage`, indépendamment de tout compte.
- **Décision** : `identity_profiles.preferred_language` / `preferred_currency` sont des champs de profil modifiables depuis `/settings`, persistés en base, mais **ne pilotent pas** automatiquement le `LocaleProvider` ni un quelconque routage de devise — ce sont des préférences déclaratives pour l'instant (utile plus tard pour les notifications/SMS localisés, le Prompt 29 multi-devises). Éviter de re-architecturer le système i18n déjà fonctionnel pour un besoin non explicitement demandé.
- **Statut** : Adopté. Devise limitée à `XOF` (le sélecteur n'a qu'une option) — multi-devises différé au Prompt 29.

## TODO_DECISION en attente (issues des spécifications de domaine)

Ces points sont explicitement non définis dans les documents source. Ils ne doivent pas être devinés ; ils doivent être tranchés par l'utilisateur au moment où le prompt correspondant les rend bloquants.

| Domaine | Décision manquante |
|---|---|
| Identity | Fournisseur SMS pour activer le flux téléphone + OTP (ADR-014) ; biométrie/WebAuthn (non implémentée) ; authentification supplémentaire (step-up) explicite sur nouvel appareil — actuellement seulement journalisée (`new_device_login`), pas bloquante ; politique de complexité mot de passe (au-delà du minimum 8 caractères) ; durée de vie des sessions Supabase (config par défaut non modifiée) ; rate limiting applicatif additionnel au-delà de celui de Supabase Auth |
| Sécurité (Back Office) | RBAC sur `/admin` — voir ADR-016, **bloquant avant toute mise en production** |
| User | Processus de changement de numéro de téléphone ; politique de changement du nom légal post-KYC (les deux restent en lecture seule dans `/settings` pour l'instant) ; intégration d'un fournisseur KYC externe (statut actuellement toujours `unverified`, jamais mis à jour automatiquement) |
| Payments | Barème complet des frais au-delà de 3,5 %/1000 FCFA ; durée d'expiration des demandes d'argent/QR ; politique de reversal auto vs manuel ; pays/devises additionnels |
| Audit | Durée de rétention des journaux par juridiction ; liste des actions à double validation ; plateforme de stockage |
| Observability | Plateforme d'observabilité retenue ; seuils d'alerte ; objectifs RTO/RPO |
| Technique (ce dépôt) | Framework de tests (Vitest/Jest) |

Chaque nouveau `TODO_DECISION` rencontré pendant l'implémentation doit être ajouté à ce tableau plutôt que deviné.
