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

## ADR-020 — Accounts : liaison simulée en attendant le Provider Gateway (Prompt 07)

- **Date** : 2026-08-25
- **Contexte** : le Prompt 06 (Linked Accounts) précède le Prompt 07 (Provider Gateway) dans le protocole — aucun adapter fournisseur réel n'existe encore. Le Master Prompt interdit explicitement toute fausse intégration financière présentée comme réelle (« Zero fausse intégration financière »).
- **Décision** :
  - `linked_accounts` (`supabase/migrations/0003_accounts.sql`) stocke provider, référence externe, statut, capabilities (statiques pour l'instant), consent_status et timestamps — le modèle de données complet attendu par le Prompt 06.
  - Le flux de liaison affiche un avertissement explicite (« Démonstration — aucune connexion réelle ») et un écran de consentement détaillant ce que Naminto.Ex pourra/ne pourra jamais faire, conformément à la section 11 de l'architecture générale.
  - Aucun solde n'est simulé ou inventé : chaque carte affiche « Solde indisponible — fournisseur non connecté » plutôt qu'un chiffre fictif.
  - Aucun PIN ni identifiant fournisseur sensible n'est demandé — seule une référence (ex. numéro de téléphone) est saisie, toujours masquée à l'affichage (`maskExternalReference`, derniers 4 chiffres uniquement).
- **Statut** : Adopté. À reconnecter au vrai Provider Gateway lors du Prompt 07 (le statut `active` deviendra alors le résultat d'un appel réel à l'adapter, pas une valeur posée directement par le client).

## ADR-021 — Reconnexion : index unique partiel plutôt que suppression physique

- **Date** : 2026-08-25
- **Contexte** : le Prompt 06 exige explicitement la « reconnexion » d'un compte précédemment délié. La déliaison est un soft-delete (`status = 'unlinked'`), et la contrainte unique initiale (`user_id, provider, external_reference`) bloquait toute nouvelle liaison avec la même référence.
- **Décision** : remplacement par un index unique **partiel** (`where status <> 'unlinked'`, `supabase/migrations/0004_accounts_reconnect.sql`) — une seule ligne active par (utilisateur, fournisseur, référence), mais l'historique délié n'empêche pas une reconnexion. `linkAccountAction` détecte une ligne déliée existante et la réactive (même `id`, `linked_at` rafraîchi) au lieu d'en créer une seconde, journalisée comme `account_reconnected` (distinct de `account_linked`).
- **Statut** : Adopté.
- **Trouvé et corrigé pendant la vérification** : la première implémentation (contrainte unique simple) aurait renvoyé à tort « déjà lié » lors d'une tentative de reconnexion légitime — repéré en testant réellement le scénario contre la base, pas seulement en relisant le code.

## ADR-022 — Provider Gateway : un adapter générique paramétré plutôt que 5 classes dupliquées

- **Date** : 2026-08-25
- **Contexte** : le Prompt 07 demande explicitement 5 adapters nommés (`OrangeSandbox`, `MTNSandbox`, `MoovSandbox`, `WaveSandbox`, `CardSandbox`), tous implémentant la même interface `ProviderAdapter`. Dupliquer la logique de simulation (soldes, idempotence, statuts) dans 5 fichiers quasi identiques violerait la règle « ne duplique aucun composant/système ».
- **Décision** : une fabrique unique `createSandboxAdapter(config)` (`src/domains/providers/sandbox/create-sandbox-adapter.ts`) porte toute la logique de simulation ; les 5 fichiers nommés (`orange.ts`, `mtn.ts`, `moov.ts`, `wave.ts`, `card.ts`) ne font qu'appeler cette fabrique avec leur configuration propre (capacités, support du refund). Le `Provider Registry` (`src/domains/providers/registry.ts`) les enregistre par un `Map<Provider, ProviderAdapter>`. Ajouter un 6ᵉ fournisseur SANDBOX ne nécessite qu'un nouveau fichier de config + un appel `registerAdapter()` — zéro modification du cœur financier, conformément à l'exigence du Prompt 07.
- **Statut** : Adopté.
- **Vérifié empiriquement** (script autonome, hors Next.js) : idempotence (rejeu de la même clé → même transaction, aucun double débit), échec pour solde insuffisant, refus d'annuler une transaction déjà confirmée, refund respectant `supportsRefund` par fournisseur, health check, parsing de webhook.

## ADR-023 — Accounts (Prompt 06) rebranché sur le Provider Gateway

- **Date** : 2026-08-25
- **Contexte** : le domaine Accounts (Prompt 06) avait été construit avant le Provider Gateway et créait les lignes `linked_accounts` directement, avec des capacités statiques et un message « Solde indisponible ».
- **Décision** : `linkAccountAction` appelle désormais `getProviderAdapter(provider).linkAccount(...)` (capacités dynamiques, retournées par l'adapter) et la page `/accounts` appelle `adapter.getBalance(...)` pour chaque compte actif. Le solde s'affiche clairement étiqueté « Solde (SANDBOX) » — jamais présenté comme réel, conformément au Master Prompt. `src/domains/accounts/providers.ts` ne conserve que les métadonnées visuelles (libellé, couleur) ; les capacités ne vivent plus que côté Provider Gateway.
- **Statut** : Adopté. Referme partiellement le TODO_DECISION « capabilities statiques » de l'ADR-020 (deviennent dynamiques ; resteront simulées tant que le mode SANDBOX n'est pas remplacé par REAL).
- **Testé de bout en bout** : liaison MTN via l'UI → solde SANDBOX 250 000 XOF affiché immédiatement (valeur de départ par défaut de la fabrique sandbox).

## ADR-024 — Webhook générique public, persistance différée

- **Date** : 2026-08-25
- **Contexte** : le Prompt 07 exige que chaque adapter expose une capacité webhook. Aucun fournisseur réel n'appelle jamais une route SANDBOX, mais le contrat doit exister et être exerçable.
- **Décision** : route générique `POST /api/webhooks/[provider]` (`src/app/api/webhooks/[provider]/route.ts`), ajoutée aux chemins publics de `src/proxy.ts` (un fournisseur externe n'a jamais de session Naminto.Ex). Elle appelle `adapter.verifyAndParseWebhook()` et journalise l'événement — **aucune persistance en base pour l'instant** : le domaine Transaction (Prompt 08) n'existe pas encore pour rattacher un événement webhook à une opération réelle, et la vérification de signature réelle, l'idempotence et le rejeu contrôlé sont le périmètre explicite du Prompt 25 (Webhooks).
- **Statut** : Adopté.
- **Vérifié empiriquement** : appel réel à la route (200, événement journalisé côté serveur) et rejet d'un fournisseur inconnu (404).

## ADR-025 — Vitest comme framework de tests

- **Date** : 2026-08-25
- **Contexte** : le Prompt 08 exige explicitement des « tests de transition » pour la State Machine — ce TODO_DECISION technique ne pouvait plus rester ouvert.
- **Décision** : Vitest (`vitest.config.mts`, `npm run test` / `test:watch`). Choisi pour son intégration native avec l'écosystème Vite/TypeScript, sa rapidité, et l'absence de configuration lourde comparé à Jest sur un projet Next.js App Router.
- **Statut** : Adopté. Referme le TODO_DECISION « Framework de tests » ouvert depuis le Prompt 01.
- **Conséquence** : le paquet `server-only` lève toujours une erreur hors du pipeline de build Next.js (comportement voulu, pas un bug — Next le substitue par un no-op dans ses bundles serveur). `vitest.config.mts` l'alias vers `test/stubs/server-only.ts` pour permettre de tester le code serveur en dehors de Next.

## ADR-026 — Transaction : écriture exclusivement service_role, aucune policy RLS d'écriture

- **Date** : 2026-08-25
- **Contexte** : le Prompt 08 est explicite — « Ne crée aucune possibilité de modifier librement le statut depuis le frontend ».
- **Décision** : `transactions` et `transaction_status_events` (`supabase/migrations/0005_transactions.sql`) n'ont **aucune policy INSERT/UPDATE/DELETE** — seule la lecture (par l'expéditeur ou le destinataire) est autorisée côté client. Toute écriture passe par `src/domains/payments/transactions.ts` (`service_role`), qui est le seul point d'entrée légitime (`createTransaction`, `transitionTransaction`). Il n'existe volontairement aucune Server Action générique « changer le statut » exposée à un formulaire.
- **Défense en profondeur** : un trigger Postgres (`check_transaction_status_transition`) rejoue la même validation de la State Machine côté base — si le TypeScript avait un bug, la base refuserait quand même la transition. Le trigger doit être maintenu en miroir exact de `src/domains/payments/transaction-status.ts`.
- **Statut** : Adopté.
- **Vérifié empiriquement** (tests d'intégration Vitest, `transactions.test.ts`) : idempotence par clé (aucune transaction dupliquée), transition valide journalisée dans `transaction_status_events`, transition invalide rejetée côté application (`InvalidTransactionTransitionError`) **et** côté base (contournement délibéré du service pour prouver que le trigger seul suffit à protéger l'intégrité).

## ADR-027 — État `disputed` volontairement terminal

- **Date** : 2026-08-25
- **Contexte** : la State Machine documentée (`PAYMENTS — Spécification Markdown.docx`, `docs/ARCHITECTURE.md`) définit `Réglée → Inversée | Remboursée | Contestée` mais ne précise aucune transition de sortie pour l'état contesté.
- **Décision** : `disputed` n'a aucune transition sortante dans `ALLOWED_TRANSITIONS`, plutôt que d'inventer un chemin de résolution plausible.
- **Statut** : Adopté — TODO_DECISION ci-dessous pour le workflow de résolution des litiges.

## ADR-028 — Payment Orchestrator : étapes STUB indépendantes plutôt que reportées

- **Date** : 2026-08-25
- **Contexte** : le Prompt 09 précède les moteurs qu'il orchestre (Fee: Prompt 10, Limits: Prompt 11, Ledger: Prompt 12, Risk: Prompt 17, Fraud: Prompt 18, Compliance: Prompt 19, Notification: Prompt 20, Reconciliation: Prompt 24). Construire l'orchestrateur sans ces moteurs impose un choix : attendre qu'ils existent, ou les représenter par des étapes STUB déjà présentes dans le pipeline.
- **Décision** : chaque étape vit dans son propre module (`src/domains/payments/orchestrator-steps/`), avec la signature qu'elle aura une fois réelle. Les étapes déjà couvertes par une règle **documentée** sont implémentées réellement dès maintenant (Compliance : seuil KYC 200 000 FCFA ; Fee : taux flat 3,5 %) ; celles qui n'ont aucune règle documentée restent des STUB qui ne rejettent jamais (Risk, Limits) ou ne persistent rien (Ledger, Notification, Reconciliation). Brancher le moteur réel d'une étape ne nécessite de modifier que son propre module, jamais `orchestrator.ts`.
- **Statut** : Adopté.

## ADR-029 — Fee calculé avant la création de la transaction (déviation mineure du diagramme)

- **Date** : 2026-08-25
- **Contexte** : le diagramme du Prompt 09 place « Fee » après Risk/Compliance/Limits et « Transaction » après Provider Gateway. Mais le domaine Transaction (Prompt 08) exige un enregistrement dès le début pour le suivi d'état et l'idempotence, et `total` (montant + frais) est une colonne `not null` dès la création.
- **Décision** : le calcul du frais (pur, ne dépendant que de `amount`/`currency` — jamais du résultat de Risk/Compliance/Limits) est avancé avant `createTransaction`, pour que `fee`/`total` soient corrects dès la création plutôt que mis à jour a posteriori. Le reste de l'ordre (Risk → Compliance → Limits → Routing → Provider Gateway) suit exactement le diagramme.
- **Statut** : Adopté.
- **Trouvé et corrigé pendant la vérification** : la première version calculait le frais après la création de la transaction sans jamais le persister — `transaction.fee` valait 0 au lieu de 175 pour un envoi de 5 000 FCFA. Repéré par un test d'intégration réel, pas une relecture de code.

## ADR-030 — `isInFlight` distinct de `isTerminalStatus` pour le court-circuit de rejeu

- **Date** : 2026-08-25
- **Contexte** : « retries sûrs » exige qu'un rejeu de la même idempotencyKey après un paiement déjà réglé ne réexécute aucune étape à effet de bord.
- **Décision** : `isTerminalStatus` (Prompt 08, `ALLOWED_TRANSITIONS[status].length === 0`) renvoie **false** pour `settled`, puisque `settled` a des transitions sortantes exceptionnelles (`reversed`/`refunded`/`disputed`). Un nouveau helper `isInFlight` (`src/domains/payments/transaction-status.ts`) distingue les statuts « en cours » (`created` → `provider_confirmed`) des statuts « aboutis » (`settled` inclus, plus tous les échecs terminaux). Le Payment Orchestrator court-circuite dès que `!isInFlight(transaction.status)`.
- **Statut** : Adopté.
- **Trouvé et corrigé pendant la vérification** : la première version utilisait `isTerminalStatus`, qui ne court-circuitait jamais pour une transaction déjà réglée — le rejeu tentait de retransitionner `settled → validating` et échouait avec `InvalidTransactionTransitionError`. Repéré par le test d'intégration « retries sûrs », pas une relecture de code.

## ADR-031 — Correction Provider Gateway : `receive` créditait par erreur comme `transfer`

- **Date** : 2026-08-25
- **Contexte** : la fabrique SANDBOX du Prompt 07 aliasait `receive` directement sur la même fonction que `transfer`, qui **débite** toujours le compte lié. Or `receive` doit représenter l'argent qui **entre** dans le compte lié depuis Naminto.Ex (ex. destination = compte lié), donc **créditer**. Cette confusion n'avait aucune conséquence visible avant le Prompt 09 : rien n'appelait encore `receive()`.
- **Décision** : `create-sandbox-adapter.ts` a désormais deux fonctions distinctes — `executeTransfer` (débite) et `executeReceive` (crédite), chacune avec sa propre idempotence.
- **Statut** : Corrigé.
- **Trouvé pendant la vérification** : en écrivant le Payment Orchestrator (Prompt 09) et en réfléchissant à quelle méthode appeler selon que le compte lié est source ou destination — pas détecté au Prompt 07 faute d'appelant réel à l'époque. Une suite de tests Vitest dédiée (`create-sandbox-adapter.test.ts`, absente au Prompt 07) couvre maintenant explicitement les deux directions.

## ADR-032 — `transitionTransaction` accepte des champs additionnels à persister

- **Date** : 2026-08-25
- **Contexte** : `provider_transaction_id` était bien renvoyé dans l'objet transaction retourné par l'orchestrateur, mais jamais réellement écrit en base — la fonction `transitionTransaction` (Prompt 08) ne touchait que la colonne `status`.
- **Décision** : `transitionTransaction(id, to, reason?, extra?)` accepte un 4ᵉ paramètre optionnel (`{ providerTransactionId }` pour l'instant) fusionné dans la même requête `update`, pour que la transition de statut et l'enregistrement du résultat fournisseur restent atomiques.
- **Statut** : Corrigé.
- **Trouvé et corrigé pendant la vérification** : un test relisant `provider_transaction_id` **depuis la base** (pas seulement la valeur renvoyée en mémoire par l'orchestrateur) aurait échoué sans ce correctif — ajouté spécifiquement après avoir remarqué que rien n'appelait jamais d'`update` avec ce champ.

## ADR-033 — Fee Engine : Routing avancé avant la création de la transaction

- **Date** : 2026-08-25
- **Contexte** : le Prompt 10 exige explicitement que `provider` soit une dimension sur laquelle une règle de frais peut se spécialiser. Or `provider` n'était connu qu'après Routing, que le Prompt 09 plaçait après le calcul du frais dans son implémentation initiale.
- **Décision** : `routeRequest` est désormais résolu avant `calculateFee` et avant `createTransaction` (voir `orchestrator.ts`). Routing reste une lecture pure sans effet de bord — l'avancer ne change aucun résultat, et permet au Fee Engine de recevoir `provider` dès le premier calcul. Une erreur de routing (compte lié introuvable, non actif) est donc maintenant classifiée `VALIDATION_ERROR` et survient avant toute création de transaction, plutôt que `PROVIDER_ERROR` en cours de traitement.
- **Statut** : Adopté. Complète l'ADR-029 (Prompt 09) sur le calcul anticipé du frais.

## ADR-034 — Fee Engine entièrement piloté par la configuration (`fee_rules`)

- **Date** : 2026-08-25
- **Contexte** : Prompt 10 — « Ne code aucune règle tarifaire dans les composants UI » et « Toutes les règles doivent être configurables ».
- **Décision** : `fee_rules` (`supabase/migrations/0006_fee_rules.sql`) porte toutes les règles ; chaque colonne optionnelle (`country`, `currency`, `min_amount`/`max_amount`, `source_type`, `destination_type`, `provider`, `transaction_type`, `user_tier`) vaut NULL comme joker. La règle active la plus spécifique (le plus de dimensions contraintes) qui correspond à la requête est retenue (`src/domains/payments/fee-engine/match-rule.ts`, pur et testé unitairement). Une seule règle est semée à ce stade — le taux 3,5 % XOF déjà documenté (ADR précédent) — devenue une donnée configurable au lieu d'une constante TypeScript.
- **`feePayer`** : la règle porte un `fee_payer` par défaut, mais l'appelant peut le surcharger explicitement (`feePayerOverride`) — reflète le choix utilisateur documenté (architecture générale, section 28 : « Qui paie les frais ? »), pas encore exposé dans une UI (Send Money, Prompt 13).
- **Statut** : Adopté.
- **Accès** : aucune policy RLS cliente sur `fee_rules` — lecture/écriture réservées au `service_role`, faute d'UI Back Office de tarification (Prompt 22).
- **Vérifié empiriquement** (tests d'intégration) : le taux de repli à plusieurs montants (1000/5000/10000/250000 FCFA), `feePayerOverride`, une règle fournisseur plus spécifique l'emportant sur le taux générique, le respect d'une plage de montant, et l'absence de règle correspondante (devise inconnue) levant `NoMatchingFeeRuleError`.

## TODO_DECISION en attente (issues des spécifications de domaine)

Ces points sont explicitement non définis dans les documents source. Ils ne doivent pas être devinés ; ils doivent être tranchés par l'utilisateur au moment où le prompt correspondant les rend bloquants.

| Domaine | Décision manquante |
|---|---|
| Identity | Fournisseur SMS pour activer le flux téléphone + OTP (ADR-014) ; biométrie/WebAuthn (non implémentée) ; authentification supplémentaire (step-up) explicite sur nouvel appareil — actuellement seulement journalisée (`new_device_login`), pas bloquante ; politique de complexité mot de passe (au-delà du minimum 8 caractères) ; durée de vie des sessions Supabase (config par défaut non modifiée) ; rate limiting applicatif additionnel au-delà de celui de Supabase Auth |
| Sécurité (Back Office) | RBAC sur `/admin` — voir ADR-016, **bloquant avant toute mise en production** |
| User | Processus de changement de numéro de téléphone ; politique de changement du nom légal post-KYC (les deux restent en lecture seule dans `/settings` pour l'instant) ; intégration d'un fournisseur KYC externe (statut actuellement toujours `unverified`, jamais mis à jour automatiquement) |
| Payments | Barème dégressif réel au-delà du taux de repli 3,5 %/1000 FCFA (la table `fee_rules` le permet, mais aucune règle par palier n'est encore saisie) ; notion de `user_tier` (colonne prête, aucun palier utilisateur n'existe encore côté User) ; durée d'expiration des demandes d'argent/QR ; politique de reversal auto vs manuel ; pays/devises additionnels ; workflow de résolution d'un statut `disputed` (ADR-027) |
| Audit | Durée de rétention des journaux par juridiction ; liste des actions à double validation ; plateforme de stockage |
| Observability | Plateforme d'observabilité retenue ; seuils d'alerte ; objectifs RTO/RPO |
| Accounts / Providers | Adapters REAL pour Orange/MTN/Moov/Wave/cartes — identifiants API, contrats, endpoints à obtenir auprès de chaque fournisseur (bloquant pour toute mise en production) ; vérification de signature webhook réelle et persistance (Prompt 25) ; détection automatique `connection_expired`/`provider_unavailable` (Availability Engine, Prompt 47) |

Chaque nouveau `TODO_DECISION` rencontré pendant l'implémentation doit être ajouté à ce tableau plutôt que deviné.
