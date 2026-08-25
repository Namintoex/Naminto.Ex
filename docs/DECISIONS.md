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

## ADR-035 — Utilitaire `pickMostSpecific` partagé entre Fee Engine et Limit Engine

- **Date** : 2026-08-25
- **Contexte** : Fee Engine (Prompt 10) et Limit Engine (Prompt 11) partagent exactement le même principe de résolution — parmi les règles configurables qui correspondent à une requête, retenir la plus spécifique.
- **Décision** : extraction dans `src/domains/payments/shared/pick-most-specific.ts` (générique, `<T>`), réutilisé par `fee-engine/match-rule.ts` (refactorisé sans changement de comportement, 18 tests existants toujours au vert) et `limit-engine/match-rule.ts`. La logique de correspondance elle-même (`ruleMatches`, dimensions différentes par moteur) reste propre à chaque domaine — seul le « retenir le plus spécifique » est partagé.
- **Statut** : Adopté.

## ADR-036 — Limit Engine : table vide au départ, absence de règle ≠ refus

- **Date** : 2026-08-25
- **Contexte** : contrairement au Fee Engine (taux 3,5 % documenté), aucune valeur de limite n'est définie dans les documents source du projet.
- **Décision** : `limit_rules` (`supabase/migrations/0007_limit_rules.sql`) n'est semée d'aucune règle. Le Limit Engine traite l'absence de règle pour un type donné comme « aucune contrainte », jamais comme un refus — conforme à la règle du Master Prompt « si une information n'est pas définie, ne l'invente pas ». Quatre types de limite supportés : `per_transaction_amount`, `daily_amount`, `monthly_amount` (cumul sur la période calendaire courante, UTC), `frequency_count` (nombre d'opérations sur une fenêtre glissante configurable en heures). Chaque règle peut se spécialiser par pays/devise/statut KYC/fournisseur/type de transaction/palier utilisateur (mêmes jokers NULL que `fee_rules`).
- **Décision explicable** : `checkLimits` retourne `{ allowed, violations[] }` où chaque violation détaille la règle, le plafond et l'usage projeté — jamais un simple booléen opaque, conformément à l'exigence explicite du Prompt 11.
- **Calcul de l'usage** : lit directement `transactions` (statuts exclus : `failed`/`rejected`/`cancelled`/`expired` — tout le reste, y compris les statuts en cours, compte, de façon volontairement conservatrice).
- **Jamais de blocage frontend uniquement** : le moteur s'exécute exclusivement côté serveur (Payment Orchestrator, `service_role`) — aucune policy RLS cliente sur `limit_rules`.
- **Statut** : Adopté.
- **Vérifié empiriquement** : absence de règle toujours autorisée ; refus par `per_transaction_amount` avec décision explicable ; `daily_amount` tenant compte de l'usage réellement réglé ; `frequency_count` refusant après N opérations réelles sur la fenêtre ; une règle KYC-spécifique l'emportant sur la règle générique ; bout-en-bout dans l'orchestrateur (`LIMIT_ERROR` → transaction `failed`).

## ADR-037 — Tests d'intégration en série (`fileParallelism: false`)

- **Date** : 2026-08-25
- **Contexte** : `fee_rules` et `limit_rules` sont des configurations **globales**, non scopées par utilisateur. Vitest exécute les fichiers de test en parallèle par défaut ; une règle temporaire posée par un fichier peut donc fausser un test d'un autre fichier tournant au même instant contre le même projet Supabase partagé.
- **Décision** : `fileParallelism: false` dans `vitest.config.mts`. Les fichiers de test s'exécutent en série (plus lent, ~80 s pour 64 tests contre ~40 s en parallèle) mais sans interférence.
- **Statut** : Adopté.
- **Trouvé et corrigé pendant la vérification** : le test « portefeuille → portefeuille » de `orchestrator.test.ts` échouait par intermittence avec `LIMIT_ERROR`, provoqué par la règle `frequency_count` temporaire du test `check-limits.test.ts` exécuté en parallèle sur un utilisateur totalement différent — pas un bug du Limit Engine lui-même, mais une leçon sur l'isolation des tests d'intégration face à une configuration globale partagée.

## ADR-038 — Ledger : immuabilité réelle de `ledger_entries`, y compris pour `service_role`

- **Date** : 2026-08-25
- **Contexte** : le Prompt 12 exige un Ledger « append-only » comme source comptable de vérité (`docs/ARCHITECTURE.md`, section 11). En production, l'application n'accède jamais à la base autrement que via `service_role` — si ce rôle pouvait modifier ou supprimer une écriture, la garantie d'immuabilité serait purement conventionnelle, pas réelle.
- **Décision** : `supabase/migrations/0008_ledger.sql` ajoute un trigger (`forbid_ledger_entries_mutation`) qui bloque UPDATE et DELETE sur `ledger_entries` pour **tout rôle**, y compris `service_role`. Toute correction (erreur, litige) doit être une nouvelle écriture de type `reversal`/`refund`, jamais une réécriture.
- **Statut** : Adopté.
- **Conséquence assumée sur les tests d'intégration** : une transaction créée pendant un test qui atteint réellement le règlement (`recordSettlement`) garde définitivement ses écritures et son propre enregistrement `transactions` en base (la contrainte de clé étrangère empêche de supprimer une transaction référencée par des écritures qu'on ne peut plus supprimer) — exactement comme en production. `orchestrator.test.ts` et `ledger/record-entries.test.ts` ne suppriment donc en fin de test que les transactions qui n'ont **jamais** été réglées ; les autres restent en base, au même titre que le compte de démonstration `demo.naminto.ex@example.test` laissé volontairement en place.

## ADR-039 — Ledger : mapping compte source/destination dérivé de `source_type`/`destination_type`

- **Date** : 2026-08-25
- **Contexte** : aucun document source ne précise explicitement quel compte interne du grand livre représente chaque combinaison possible de `source_type`/`destination_type`/`provider` d'une transaction — seul le principe général (comptabilité en partie double) est documenté.
- **Décision** (`src/domains/payments/ledger/record-entries.ts`) : `naminto_wallet` → compte `user_wallet` (scopé par `sender_user_id`/`recipient_user_id`) ; `linked_account` → compte `provider_suspense` (scopé par `provider`, représente l'argent en transit sur le rail du fournisseur) ; `destination_type = external` (hors Naminto.Ex et hors fournisseur modélisé) → compte générique `external_suspense`. Les frais, quand ils existent, créditent toujours un compte `fee_revenue` global par devise.
- **Statut** : Adopté à titre de choix d'implémentation raisonnable — **TODO_DECISION** si un plan comptable plus précis (un compte de transit par fournisseur *et* par pays, par exemple) est requis plus tard.

## ADR-040 — Ledger : garde-fous applicatifs avant les contraintes base (montant, devise, équilibre)

- **Date** : 2026-08-25
- **Contexte** : `ledger_entries` porte déjà une contrainte `amount > 0` côté base, mais rien ne garantissait qu'un lot d'écritures reste équilibré (Σdébits = Σcrédits) ni homogène en devise avant l'insertion.
- **Décision** : `writeBalancedEntries` (fonction interne unique par laquelle transitent `recordSettlement`/`recordReversal`/`recordRefund`) valide le lot avant tout appel réseau — montant strictement positif (`LedgerInvalidAmountError`), devise unique par lot (`LedgerCurrencyMismatchError`), équilibre débit/crédit (`LedgerImbalanceError`) — même logique de défense en profondeur que la State Machine de transaction (ADR-026).
- **Statut** : Adopté.
- **Vérifié empiriquement** (tests d'intégration `ledger/record-entries.test.ts`) : frais payés par l'expéditeur/le destinataire (écritures équilibrées dans les deux cas) ; double appel à `recordSettlement`/`recordRefund` sans deuxième lot (idempotence) ; montant ≤ 0, devises mêlées et lot déséquilibré tous rejetés avant écriture ; transaction inexistante rejetée pour les trois fonctions ; `recordReversal` sans règlement préalable rejeté (`LedgerMissingSettlementError`) ; écritures miroir d'un reversal strictement inverses de celles du règlement, compte par compte.

## ADR-041 — Send Money : deux combinaisons couvertes, `feePayerOverride` et référence externe enfin branchés

- **Date** : 2026-08-25
- **Contexte** : construire l'UI Send Money (Prompt 13) a mis en évidence que le Payment Orchestrator (Prompts 09-11), tel que testé jusqu'ici, ne couvrait réellement que deux combinaisons source/destination — `naminto_wallet → naminto_wallet` (portefeuille à portefeuille) et `linked_account → external` (débit d'un compte lié du sender, vérifié par `orchestrator.test.ts`). Une troisième combinaison, `naminto_wallet → external` (envoyer depuis son solde Naminto.Ex directement vers un numéro externe quelconque), donnerait `route.provider = null` dans `routing.ts` : la transaction se réglerait sans jamais appeler un fournisseur, ce qui ne correspond à aucune règle documentée sur la façon dont Naminto.Ex disperse réellement des fonds vers un rail mobile money externe.
- **Décision** : l'UI Send Money n'expose que les deux combinaisons réellement couvertes. Envoyer vers un bénéficiaire externe implique de choisir l'un de ses **propres** comptes liés comme source (mêmes contraintes que le Prompt 06 : Naminto.Ex ne connaît que les comptes de l'utilisateur connecté, jamais ceux d'un tiers). `naminto_wallet → external` et `linked_account → naminto_wallet` restent **TODO_DECISION** — non exposés tant que le modèle de disbursement externe (comment Naminto.Ex crédite un rail mobile money quelconque sans compte lié intermédiaire) n'est pas défini par une spécification.
- **`feePayerOverride`** : `PaymentRequest` (orchestrator-steps/types.ts) n'avait jamais ce champ, et `orchestrator-steps/fee.ts` ne le passait donc jamais à `calculateFee` — le choix « qui paie les frais ? », déjà prévu côté Fee Engine depuis l'ADR-034, n'avait tout simplement aucun appelant. Ajouté au type et propagé ; testé par un nouveau cas dans `orchestrator.test.ts` (transaction wallet-à-wallet avec `feePayerOverride: "recipient"`, `fee_payer` persisté vérifié).
- **`destination_external_reference`** (`supabase/migrations/0009_send_money.sql`) : `transactions.destination_reference` est un `uuid` référençant `linked_accounts` (0005_transactions.sql) — incompatible avec un numéro de téléphone en texte libre pour un bénéficiaire externe (qui n'a par construction aucune ligne `linked_accounts`, Naminto.Ex ne le connaît pas). Nouvelle colonne texte dédiée plutôt qu'un réemploi incompatible du type existant.
- **Bug trouvé et corrigé en marge** : `orchestrator.ts` assignait toujours `destinationReference: request.destinationLinkedAccountId` à la création de la transaction, y compris pour `destinationType = 'external'` — la référence du bénéficiaire externe n'était donc jamais persistée nulle part avant ce prompt (aucun appelant réel n'avait encore exercé ce chemin). Corrigé : `destinationReference` reste réservé au cas `linked_account`, `destinationExternalReference` est désormais dérivé et persisté séparément pour le cas `external`. Repéré en écrivant `sendMoneyAction`, pas par relecture de code — `orchestrator.test.ts` échouait avec `invalid input syntax for type uuid` en repassant un numéro de téléphone dans `destinationLinkedAccountId`.
- **QR** : la spécification mentionne un scan QR pour identifier le bénéficiaire, mais aucune capture caméra n'est implémentée (non testable dans cet environnement de développement) — l'identifiant Naminto.Ex se saisit en texte, avec une mention « bientôt disponible ». N'affaiblit pas l'exigence « un scan QR ne doit jamais exécuter automatiquement » : aucune UI de scan n'existe pour la violer, et le Récapitulatif reste de toute façon un point de confirmation explicite obligatoire.
- **Statut** : Adopté. La migration 0009 a été appliquée au projet Supabase réel (Session Pooler, identifiants redonnés par l'utilisateur pour cette seule opération).

## ADR-042 — Request Money : jeton de capacité plutôt que RLS publique, échéance 7 jours, origine absolue fiable

- **Date** : 2026-08-26
- **Contexte** : le Prompt 14 exige un identifiant « sécurisé et expirant » pour Request Money, partageable par lien et QR, sans jamais placer d'information secrète dans l'URL ou le QR.
- **Décision** : `money_requests.token` (`crypto.randomUUID()`, même générateur que `idempotencyKey` ailleurs dans ce domaine) sert de **jeton de capacité** — c'est lui, pas une policy RLS, qui contrôle l'accès en lecture depuis un lien partagé. Aucune policy RLS `select` publique n'existe sur `money_requests` : un visiteur qui ne connaît pas le jeton ne peut pas énumérer les demandes d'un tiers, y compris authentifié. La résolution par jeton passe par `service_role` (`getMoneyRequestByToken`), qui ne renvoie jamais que les champs nécessaires à l'affichage.
- **Échéance par défaut** : 7 jours (`MONEY_REQUEST_TTL_MS`), valeur raisonnable non documentée dans les sources — **TODO_DECISION** si une autre durée est requise (voir tableau ci-dessous).
- **Statut effectif calculé, jamais écrit physiquement** : une ligne `pending` dont `expires_at` est dépassé est traitée comme `expired` à la lecture (`effectiveStatus`), sans tâche planifiée pour réécrire les lignes en base — cohérent avec l'absence de dépendance à un job hors périmètre de ce prompt.
- **Idempotence du règlement** : `fulfillMoneyRequest` utilise un `idempotencyKey` déterministe (`money-request-${token}`) pour l'appel au Payment Orchestrator, puis marque la demande `fulfilled` par une mise à jour **conditionnelle** (`.eq('status', 'pending')`) pour ne jamais écraser un règlement déjà enregistré par une tentative concurrente. Un rejeu par le **même** payeur (double clic, coupure réseau) renvoie la transaction déjà créée sans rappeler l'orchestrateur ; un rejeu par un payeur **différent** sur une demande déjà réglée est rejeté.
- **Origine absolue du lien de partage** : la première version utilisait `headers().get("origin")` (repris de `registerAction`, où c'est fiable car déclenché par une soumission de formulaire). Sur une navigation GET classique vers `/request/[id]`, le navigateur n'envoie pas d'en-tête `Origin` — le lien affiché était donc relatif (`/pay/<token>`) et donnait un QR invalide. Corrigé via `src/lib/request-origin.ts`, qui reconstruit l'origine à partir de `Host`/`x-forwarded-host` (toujours présents), avec `x-forwarded-proto` pour le protocole. Repéré en ouvrant réellement le lien affiché, pas par relecture de code.
- **Statut** : Adopté. Migration `0010_money_requests.sql` appliquée au projet Supabase réel (Session Pooler, identifiants redonnés par l'utilisateur pour cette seule opération, comme pour la migration 0009).
- **Vérifié empiriquement** : cycle de vie complet (création, listing scopé RLS, annulation avec garde de statut, auto-paiement bloqué, règlement réel via un second compte de test, idempotence du rejeu, refus sur demande annulée/expirée/inexistante) — 12 tests d'intégration. `listOwnMoneyRequests` (client RLS, `cookies()`) n'est testable que dans un vrai contexte de requête Next.js, comme `getLinkedAccounts`/`getIdentityProfile` ailleurs dans ce dépôt — vérifié manuellement dans le navigateur plutôt que par Vitest.

## ADR-043 — QR Engine : interprétation des 4 types, signature HMAC, pas de scanner caméra

- **Date** : 2026-08-26
- **Contexte** : le Prompt 15 nomme quatre types de QR (`BENEFICIARY`, `REQUEST`, `PAYMENT_REQUEST`, `PREFILLED_PAYMENT`) et exige un cycle `decode → validate → resolve → display → confirm → authenticate → execute`, jamais `scan → execute`, sans élaborer davantage sur la sémantique de chaque type — vérifié en relisant `PAYMENTS — Spécification Markdown.docx` (reconstitution du 2026-08-25, elle-même dérivée du même prompt) : aucun détail supplémentaire n'existe nulle part dans les documents source.
- **Décision — sémantique retenue** :
  - `BENEFICIARY` : identifie un utilisateur Naminto.Ex (`naminto_id`), aucun montant — remplace le QR en clair de `/receive` (Prompt 14).
  - `PAYMENT_REQUEST` : instantané enrichi (montant, devise, demandeur) d'une demande d'argent existante (`money_requests`, Prompt 14) — utilisé par `/request/[id]`.
  - `REQUEST` : référence minimale (jeton seul) du même objet `money_requests` — traité comme une variante plus légère de `PAYMENT_REQUEST`, pleinement prise en charge par le moteur (decode/validate/resolve, redirection vers `/pay/[token]`) mais sans point de génération dans l'UI de ce dépôt, faute de second cas d'usage produit clairement distinct à ce stade.
  - `PREFILLED_PAYMENT` : paiement à montant fixe vers un bénéficiaire précis, **sans** ligne `money_requests` — seul type réellement nouveau par rapport à ce qui existait déjà (Prompts 13-14), ajouté sur `/receive` (« Demander un montant précis »).
  - Ce choix privilégie la réutilisation maximale de l'existant (Send Money, `/pay/[token]`) plutôt que de dupliquer une UI de paiement pour chaque type — cohérent avec la règle du Master Prompt « ne duplique aucun composant/système ». Si une distinction produit plus précise entre `REQUEST` et `PAYMENT_REQUEST` est requise, c'est un TODO_DECISION (voir tableau ci-dessous).
- **Signature** : HMAC-SHA256 avec un secret généré localement (`crypto.randomBytes(32)`, `QR_SIGNING_SECRET` dans `.env.local`, jamais commité — voir ADR sur les secrets, section Sécurité générale). Format compact `<payload base64url>.<signature base64url>`, vérifié en temps constant (`timingSafeEqual`) pour ne pas exposer de canal auxiliaire de comparaison. Un payload correctement signé mais expiré, ou dont la forme ne correspond pas au type déclaré, est rejeté avant toute résolution en base — la signature prouve l'origine (« émis par Naminto.Ex »), jamais que le contenu est encore d'actualité (rôle de `resolve.ts`, toujours exécuté séparément).
- **Aucun scanner caméra** : comme au Prompt 13 (ADR-041), la capture caméra n'est pas implémentée — non testable dans cet environnement de développement. Contrairement au Prompt 13 cependant, ce n'est pas vraiment une limitation produit : chaque QR généré par ce moteur encode une URL ordinaire (`/qr/<encoded>` ou `/pay/<token>`), donc lisible par n'importe quelle application d'appareil photo standard d'un téléphone — un scanner intégré à l'application serait un raccourci UX, pas une fonctionnalité bloquante pour que le QR Engine soit réellement utilisable.
- **`PREFILLED_PAYMENT` et idempotence sans ligne persistée** : n'ayant pas de `money_requests.id`, `idempotencyKey` est dérivée d'un hash du QR brut et de l'id du payeur (`qr-prefilled-<hash>`) plutôt qu'un identifiant de ligne — un même payeur qui rejoue la confirmation obtient toujours la même transaction ; deux payeurs différents scannant le même QR statique (réutilisable jusqu'à expiration) obtiennent chacun la leur, comme attendu d'un QR de paiement réutilisable.
- **Statut** : Adopté.
- **Vérifié empiriquement** : 13 tests (signature/altération/expiration/payload implausible pour `encodeQr`/`verifyQr`, decode→validate→resolve réel contre le vrai projet Supabase pour `BENEFICIARY` et `PREFILLED_PAYMENT`) ; bout-en-bout manuel contre le vrai projet — `PREFILLED_PAYMENT` payé par un second compte réel (transaction settled, montant et frais corrects), `BENEFICIARY` redirigeant vers Send Money avec bénéficiaire pré-vérifié, `PAYMENT_REQUEST` redirigeant vers `/pay/[token]`, QR expiré et QR à signature falsifiée tous deux rejetés avec un message distinct.

## ADR-044 — History : le reçu recalcule débit/crédit comme le Ledger, ne lit pas `transactions.total`

- **Date** : 2026-08-26
- **Contexte** : le Prompt 16 exige que « le reçu soit cohérent avec le Ledger ». En construisant la page détail (`/history/[reference]`), relire `transactions.total` pour afficher le montant réellement débité de l'expéditeur aurait été trompeur : `createTransaction` (`src/domains/payments/transactions.ts`, Prompt 08) fixe `total = amount + fee` **inconditionnellement**, une formule antérieure au `fee_payer` introduit au Prompt 10 et réellement branché au Prompt 13. Quand `fee_payer = 'recipient'`, le montant réellement débité de l'expéditeur est `amount` (pas `amount + fee`) et le montant réellement crédité au destinataire est `amount - fee` — exactement ce que `recordSettlement` (`src/domains/payments/ledger/record-entries.ts`, Prompt 12) calcule pour les écritures Ledger, mais pas ce que `total` reflète.
- **Décision** : la page détail et le reçu recalculent `senderDebit`/`recipientCredit` avec la même formule exacte que `recordSettlement`, jamais depuis `total`. `total` reste inchangé en base (aucune migration nécessaire, aucun appelant existant n'en dépendait pour un calcul fee_payer-sensible) — seul son usage pour l'affichage du reçu était concerné.
- **Trouvé en construisant ce prompt**, pas par relecture de code isolée : en vérifiant manuellement un envoi réel avec `fee_payer = sender` (750 XOF + 26,25 XOF de frais), afficher `total` aurait donné le même résultat par coïncidence (`total = senderDebit` dans ce cas précis) — c'est en écrivant délibérément le test symétrique pour `fee_payer = recipient` que la divergence entre `total` et `senderDebit` réel est devenue visible.
- **Statut** : Corrigé (dans l'affichage seulement — `transactions.total` n'est pas modifié).
- **Conséquence** : si un futur écran a besoin d'afficher un montant réellement débité/crédité (au-delà du reçu), il doit utiliser la même formule dérivée de `fee_payer`, pas `total`, sous peine de répéter cette même divergence.

## ADR-045 — Risk Engine : seuils en constantes, agrégation sans composition, calibrage contre la suite de tests réelle

- **Date** : 2026-08-26
- **Contexte** : le Prompt 17 exige d'analyser sept dimensions (amount, frequency, history, device, beneficiary, behavior, context) et de renvoyer LOW/MEDIUM/HIGH avec des raisons structurées, sans jamais écrire dans le Ledger. Aucune valeur de seuil n'est documentée nulle part dans les sources du projet — comme pour le Limit Engine (ADR-036) et le Fee Engine (ADR-034), des valeurs raisonnables ont dû être choisies par implémentation.
- **Configurabilité** : contrairement au Fee Engine (Prompt 10) et au Limit Engine (Prompt 11), dont l'énoncé exige explicitement « toutes les règles doivent être configurables », le Prompt 17 ne le demande pas. Décision : les seuils du Risk Engine restent des constantes de code (`assess-risk.ts`), pas une table `risk_rules` — cohérent avec la lettre du prompt, pas une omission. **TODO_DECISION** si une configurabilité en base est requise plus tard (voir tableau ci-dessous).
- **Agrégation sans règle de composition** : la première version escaladait automatiquement la décision à HIGH dès que 3 signaux ou plus étaient MEDIUM simultanément. Trouvé problématique en vérifiant contre la vraie suite de tests d'intégration existante (Prompts 08-16) : un compte de test fraîchement créé (par construction, sans historique) effectuant un envoi externe de 250 000 XOF — exactement le scénario du test `COMPLIANCE_REJECTION` déjà en place — cumule à lui seul les signaux `history` (compte sans historique), `beneficiary` (nouveau bénéficiaire) et `context` (sortie externe pour un montant élevé), tous MEDIUM : la composition aurait fait passer la décision à HIGH et bloqué la transaction **avant même** que Compliance n'ait l'occasion de la rejeter pour la raison que ce test vérifie précisément — cassant un test déjà correct pour une raison sans rapport. Décision : la décision globale retient uniquement le signal le plus sévère, sans composition — un seul signal HIGH suffit à bloquer, mais aucun nombre de signaux MEDIUM ne s'y substitue. La combinaison de plusieurs signaux modérés en une action (bloquer, step-up, revue manuelle) est explicitement le rôle du Fraud Engine (Prompt 18 : « implémente une architecture de règles », actions `ALLOW`/`STEP_UP`/`BLOCK`/`MANUAL_REVIEW`) — pas une responsabilité à anticiper dans le Risk Engine lui-même.
- **Seuil de fréquence recalibré pour la même raison** : `frequency` compte les opérations de l'expéditeur sur la dernière heure (réutilise `getFrequencyUsage`, Limit Engine). Plusieurs fichiers de test créent 8 à 10 transactions pour le même utilisateur de test en quelques dizaines de secondes (usage légitime de test, pas un usage frauduleux) — un seuil HIGH à 5 aurait déclenché `RISK_REJECTION` au milieu de suites de tests sans rapport avec le Risk Engine. Seuils retenus : MEDIUM à partir de 5, HIGH à partir de 15 — cohérents avec un usage réel plausible (quelqu'un qui paie plusieurs factures à la suite) tout en couvrant la suite de tests existante avec une marge confortable.
- **`device` jamais pénalisé par absence d'information** : `deviceFingerprint` est optionnel sur `PaymentRequest` ; quand il est absent, le signal `device` reste `LOW` (« non transmis à l'évaluation du risque »), jamais `MEDIUM` par défaut — ne pas confondre « nous n'avons pas vérifié » avec « nous avons vérifié et trouvé un problème ».
- **`deviceFingerprint` threadé jusqu'à l'orchestrateur** : `PaymentRequest` n'avait jamais ce champ avant ce prompt. Ajouté et renseigné par les trois appelants réels (`sendMoneyAction`, `fulfillMoneyRequest`/`payMoneyRequestAction`, `payPrefilledQrAction`) via `getOrCreateDeviceCookie()` (Identity, Prompt 04) — le même cookie httpOnly déjà utilisé à la connexion pour distinguer les appareils, aucun nouveau mécanisme de suivi introduit.
- **Trouvé et corrigé en marge** : `payMoneyRequestAction` (Prompt 14) et `payPrefilledQrAction` (Prompt 15) ne classifiaient que `AUTH_ERROR` correctement — tout autre code d'erreur de l'orchestrateur (`RISK_REJECTION`, `COMPLIANCE_REJECTION`, `LIMIT_ERROR`, `PROVIDER_ERROR`, `TIMEOUT`) retombait sur le message générique « erreur technique ». Resté invisible jusqu'ici car aucun de ces codes n'était auparavant atteignable pour ces deux parcours (Risk ne rejetait jamais, et les autres codes sont rares dans leurs scénarios). Corrigé en réutilisant la même table de correspondance que Send Money.
- **Statut** : Adopté.
- **Vérifié empiriquement** : 22 tests (7 signaux purs + agrégation, sans composition, en unitaire ; `fetchRiskContext`/`assessRisk` contre le vrai Supabase — historique, bénéficiaire, appareil réels) ; suite complète (133 tests) toujours au vert après branchement réel dans l'orchestrateur ; bout-en-bout manuel — un envoi de 600 000 XOF réellement bloqué avec le message attendu, transaction persistée `failed`, avant que Compliance n'intervienne.

## TODO_DECISION en attente (issues des spécifications de domaine)

Ces points sont explicitement non définis dans les documents source. Ils ne doivent pas être devinés ; ils doivent être tranchés par l'utilisateur au moment où le prompt correspondant les rend bloquants.

| Domaine | Décision manquante |
|---|---|
| Identity | Fournisseur SMS pour activer le flux téléphone + OTP (ADR-014) ; biométrie/WebAuthn (non implémentée) ; authentification supplémentaire (step-up) explicite sur nouvel appareil — actuellement seulement journalisée (`new_device_login`), pas bloquante ; politique de complexité mot de passe (au-delà du minimum 8 caractères) ; durée de vie des sessions Supabase (config par défaut non modifiée) ; rate limiting applicatif additionnel au-delà de celui de Supabase Auth ; **`identity_profiles.status` ne quitte jamais `pending_verification`** (aucun flux ne le fait jamais passer à `active` — repéré au Prompt 13 en construisant `findRecipientByNamintoId`, qui ne filtre donc volontairement pas par `status` sous peine de rendre Send Money inutilisable pour tous les comptes existants) |
| Sécurité (Back Office) | RBAC sur `/admin` — voir ADR-016, **bloquant avant toute mise en production** |
| User | Processus de changement de numéro de téléphone ; politique de changement du nom légal post-KYC (les deux restent en lecture seule dans `/settings` pour l'instant) ; intégration d'un fournisseur KYC externe (statut actuellement toujours `unverified`, jamais mis à jour automatiquement) |
| Payments | Barème dégressif réel au-delà du taux de repli 3,5 %/1000 FCFA (la table `fee_rules` le permet, mais aucune règle par palier n'est encore saisie) ; **valeurs réelles des limites** (`limit_rules` est vide — table prête mais aucun plafond journalier/mensuel/par transaction/de fréquence n'est configuré, **bloquant avant toute mise en production réelle**) ; notion de `user_tier` (colonne prête, aucun palier utilisateur n'existe encore côté User) ; politique de reversal auto vs manuel ; pays/devises additionnels ; workflow de résolution d'un statut `disputed` (ADR-027) ; modèle de disbursement pour `naminto_wallet → external` et `linked_account → naminto_wallet` (non exposés dans Send Money — ADR-041) ; scan QR réel (caméra) pour identifier un bénéficiaire ou payer une demande (ADR-041/ADR-042/ADR-043) ; **durée d'expiration des demandes d'argent** (7 jours par défaut, non documentée — ADR-042) ; **distinction produit entre les types de QR `REQUEST` et `PAYMENT_REQUEST`** (traités comme des variantes du même objet faute d'élaboration dans les sources — ADR-043, `REQUEST` sans point de génération UI) ; procédure de rotation du secret de signature QR (ADR-043) ; **seuils réels du Risk Engine** (constantes de code choisies par implémentation, calibrées pour ne pas casser la suite de tests existante plutôt que contre une donnée métier réelle — ADR-045, TODO_DECISION si une configurabilité en base ou des valeurs métier documentées sont requises) |
| Ledger | Plan comptable des comptes de transit (un `provider_suspense` par fournisseur uniquement, pas encore par pays — ADR-039) ; déclencheur réel de `recordReversal`/`recordRefund` (aucun écran de litige/remboursement n'existe encore) ; consultation du solde de portefeuille par l'utilisateur (les écritures existent, aucune UI ne les agrège encore) |
| Audit | Durée de rétention des journaux par juridiction ; liste des actions à double validation ; plateforme de stockage |
| Observability | Plateforme d'observabilité retenue ; seuils d'alerte ; objectifs RTO/RPO |
| Accounts / Providers | Adapters REAL pour Orange/MTN/Moov/Wave/cartes — identifiants API, contrats, endpoints à obtenir auprès de chaque fournisseur (bloquant pour toute mise en production) ; vérification de signature webhook réelle et persistance (Prompt 25) ; détection automatique `connection_expired`/`provider_unavailable` (Availability Engine, Prompt 47) |

Chaque nouveau `TODO_DECISION` rencontré pendant l'implémentation doit être ajouté à ce tableau plutôt que deviné.
