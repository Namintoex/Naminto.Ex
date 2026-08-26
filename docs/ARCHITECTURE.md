# NAMINTO.EX — Architecture technique

Document produit par le **Prompt 01 — Reconnaissance et architecture** du protocole `Les 30 prompts de vibecoding ultra-directifs`. Il traduit la source de vérité fonctionnelle (`NAMINTO.EX ARCHITECTURE GENERALE.docx` et les spécifications de domaine `IDENTITY`, `USER`, `PAYMENTS`, `AUDIT`, `OBSERVABILITY`) en architecture technique concrète pour ce dépôt.

## 1. Résultat de l'audit initial (2026-08-25)

Le dépôt était vierge de code au moment de l'audit : uniquement des documents Word de spécification. Aucune architecture existante à préserver — ce document définit donc l'architecture cible dès l'origine, sans dette à gérer.

## 2. Stack technique retenue

| Élément | Choix | Statut |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript | Décidé (utilisateur, 2026-08-25) |
| Gestionnaire de paquets | npm | Décidé |
| Backend / données | Supabase (Postgres, Auth, Storage) | Décidé et connecté (Prompt 04) |
| Authentification | Supabase Auth (email + mot de passe) + tables custom (PIN, appareils, audit) | Décidé (Prompt 04, ADR-013) |
| Style / Design System | Tailwind CSS v4 (tokens CSS `@theme`) + class-variance-authority + Radix UI (primitives accessibles) + lucide-react (icônes) | Décidé (Prompt 02) |
| Thème clair/sombre | next-themes | Décidé (Prompt 02) |
| i18n (Design System) | Dictionnaire léger FR/EN (contexte React) — routing i18n applicatif différé au Prompt 03 | Décidé pour le Design System, TODO_DECISION pour l'app |
| Tests | À déterminer (Vitest ou Jest + Testing Library pressenti pour Next.js/TS) | TODO_DECISION |

Voir `/docs/DECISIONS.md` pour le détail et la justification de chaque décision.

## 3. Architecture globale (couches)

Reprise stricte de la séparation imposée par le Master Prompt :

```
UI
 ↓
API (Next.js Route Handlers)
 ↓
Application Services
 ↓
Domain Services
 ↓
Provider Gateway
 ↓
Provider Adapters
```

Et transversalement, indépendants de cette pile : **Ledger, Risk, Compliance, Notifications, Audit, Reconciliation, Analytics**.

Règle absolue : **le frontend ne contient jamais de logique financière critique.** Toute décision (frais, limites, risque, autorisation) est calculée côté serveur et seulement affichée côté client.

## 4. Bounded contexts (domaines)

Chaque domaine correspond à une spécification fonctionnelle dédiée et, à terme, à un dossier `src/domains/<domain>/` isolé (application services + domain services + types), consommé par l'API et jamais directement par l'UI :

- **Identity** — voir `IDENTITY — Spécification Markdown.docx`
- **User** — voir `USER — Spécification Markdown.docx`
- **Accounts** (comptes liés Orange/MTN/Moov/Wave/cartes)
- **Payments** (Send/Receive/Request/QR/Transfers) — voir `PAYMENTS — Spécification Markdown.docx`
- **Providers** (Provider Gateway + Adapters)
- **Finance** (Ledger, Fees, Settlement, Reconciliation, Refund, Reversal)
- **Risk** (Fraud, AML/CFT, Limits, Risk Scoring)
- **Compliance** (KYC, Legal, Privacy, Regulatory Rules)
- **Support** (Naminto Assist, FAQ, Tickets, Disputes)
- **Notifications** (SMS, Push, In-App)
- **Administration** (Back Office, RBAC, Audit) — voir `AUDIT — Spécification Markdown.docx`
- **Infrastructure** (API, Events, Monitoring, Security, Backup, DR) — voir `OBSERVABILITY — Spécification Markdown.docx`

Ces dossiers ne sont créés qu'au fur et à mesure des prompts qui les implémentent (Prompt 04 et suivants) — aucun code de domaine n'est écrit au Prompt 01, conformément à la règle « n'écris aucun code inutile ».

## 5. Flux de données de référence — envoi d'argent

```
UTILISATEUR → ENVOYER → SOURCE DES FONDS → PIN/Biométrie ou Auth fournisseur
   → DESTINATION → NUMÉRO/QR → VALIDATION NUMÉRO → MONTANT → FRAIS
   → QUI PAIE LES FRAIS ? → RISK → LIMITS → AUTHENTIFICATION
   → RÉCAPITULATIF → CONFIRMATION → PAYMENT ORCHESTRATOR → PROVIDER GATEWAY
   → EXÉCUTION → { Ledger, Risk, Notification } → Réconciliation → REÇU → HISTORIQUE
```

Ce flux (détaillé dans `PAYMENTS — Spécification Markdown.docx`) est la référence pour toute implémentation du Payment Orchestrator (Prompt 09).

## 6. Conventions de code

- TypeScript strict partout — aucune erreur TypeScript tolérée (Definition of Done du Master Prompt).
- Aucun secret, clé ou identifiant fournisseur dans le code — variables d'environnement uniquement, jamais commitées (`.env*` déjà ignoré par git).
- Toute route API vérifie ses permissions côté serveur, jamais uniquement côté client.
- Un domaine ne dépend jamais directement d'un adapter fournisseur concret — uniquement de l'interface `ProviderAdapter` du Provider Gateway (Prompt 07).
- FR/EN et thèmes clair/sombre supportés dès la fondation UI (Prompt 02).

## 7. Stratégie de tests

- Tests unitaires sur chaque Domain Service (Fee Engine, Limit Engine, State Machine de transaction, Risk Engine, Fraud Engine).
- Tests d'intégration sur le Payment Orchestrator (parcours complet, y compris échecs classifiés).
- Tests de non-régression obligatoires avant de clore toute tâche (Phase F du workflow obligatoire).
- Scénarios explicitement exigés par le Master Prompt : double clic, refresh, retry, timeout, double webhook, panne fournisseur.
- Framework de test : Vitest (`npm run test`), retenu au Prompt 08 — voir `docs/DECISIONS.md` ADR-025. Les tests d'intégration (ex. `src/domains/payments/transactions.test.ts`) tournent contre le vrai projet Supabase de développement et créent/suppriment leurs propres données de test.

## 8. Sécurité

- Mot de passe et PIN Naminto.Ex : secrets indépendants, jamais stockés en clair, jamais échangés entre eux.
- Aucun PIN ou secret d'un fournisseur externe n'est jamais demandé ni stocké par Naminto.Ex.
- Naminto Assist (chatbot) ne peut jamais demander PIN/mot de passe/secret ni exécuter seul une opération financière.
- Toute opération financière est idempotente (clé d'idempotence obligatoire).
- Audit systématique des actions sensibles, utilisateur comme administratives (voir `AUDIT — Spécification Markdown.docx`).

## 9. Architecture événementielle

```
Transaction Event
 ├── Ledger
 ├── Risk
 ├── Notification
 ├── Analytics
 ├── Audit
 └── Reconciliation
```

Chaque consumer d'événement est idempotent. Chaque événement porte un `correlation_id` et un `event_id`, et supporte retry + dead-letter (Prompt 26).

## 10. Provider Gateway

Le cœur financier de Naminto.Ex ne connaît aucun fournisseur concret. Chaque fournisseur (Orange, MTN, Moov, Wave, cartes) est un `ProviderAdapter` implémentant la même interface (account linking, balance, transfer, receive, transaction status, cancellation, refund, webhook, health check). Ajouter un fournisseur = un nouvel adapter + configuration + enregistrement dans le Provider Registry, sans modifier le cœur (Prompt 07).

Toute intégration non disponible en réel doit être un adapter **SANDBOX** ou **MOCK**, jamais présenté comme une opération financière réelle. Distinction obligatoire dans le code : `REAL | SANDBOX | MOCK | UNAVAILABLE`.

## 11. Ledger

Source comptable de vérité, en écriture seule (append-only). Aucune écriture historique n'est jamais modifiée ou supprimée ; toute correction est elle-même une nouvelle écriture traçable. Le Ledger reste la référence même si les données analytiques divergent (Prompt 12).

## 12. Observabilité

Logs, Metrics, Traces — voir `OBSERVABILITY — Spécification Markdown.docx` pour le détail des métriques minimales, de l'Availability Engine et du cycle de gestion des incidents.

## 13. Design System (Prompt 02)

Fondation UI centralisée dans `src/design-system/`, consommée via l'alias `@/design-system` :

- **Tokens** : `src/app/globals.css` — palette de marque (placeholder, voir `docs/DECISIONS.md` ADR-006), neutres, statuts (success/warning/danger/info), radius, ombres, tokens sémantiques clair/sombre exposés à Tailwind via `@theme inline`.
- **Composants** (`src/design-system/components/`) : Button, Input/Textarea/Select (`form-field.tsx`), Card, Badge, Alert, Modal (Radix Dialog), Table, DropdownMenu (Radix), Tabs (Radix), Spinner, Skeleton, EmptyState, ErrorState, ThemeToggle, LocaleToggle.
- **Thème** : `src/design-system/theme/theme-provider.tsx` (next-themes, stratégie `class`).
- **i18n (Design System uniquement)** : `src/design-system/i18n/` (LocaleProvider + dictionnaires FR/EN) — ne préjuge pas de la solution i18n applicative complète (routing), différée au Prompt 03.
- **Démonstration** : page `/design-system` (`src/app/design-system/page.tsx`) — rend tous les composants dans les deux thèmes et les deux langues. Aucun composant financier spécifique n'y figure, conformément au Prompt 02.

## 14. Application Shell (Prompt 03)

Fondation de navigation dans `src/shell/` :

- **`shell.tsx`** — composant unique paramétré par `variant: "user" | "admin"`, compose Header + Sidebar (desktop) + navigation mobile. Un seul composant pour les deux espaces (pas de duplication), mais séparation **structurelle réelle** au niveau des routes (voir ci-dessous).
- **`nav-config.ts`** — `userNavItems` (10 routes) et `adminNavItems` (17 routes, calquées sur le Back Office de la section 55 de l'architecture générale), chacune avec icône Lucide, clé de traduction et flag `primary` (affiché dans la barre d'onglets mobile).
- **`header.tsx`** — marque, badge d'espace (Application / Back Office), notifications, sélecteur de langue, sélecteur de thème, menu profil. Responsive : les libellés langue/thème se réduisent aux icônes sous `sm`.
- **`sidebar.tsx`** — navigation persistante desktop (`lg:flex`, masquée en dessous).
- **`mobile-nav.tsx`** — barre d'onglets basse (4 items primaires + « Plus ») en dessous de `lg`, le bouton « Plus » ouvre un `Sheet` listant l'intégralité des liens.
- **`notifications-menu.tsx`**, **`profile-menu.tsx`** — menus déroulants (Radix DropdownMenu) ; aucune logique financière, aucune authentification réelle (le bouton « Se déconnecter » est désactivé en attendant le Prompt 04).
- **`coming-soon-page.tsx`** — page générique « Bientôt disponible » utilisée par toutes les routes de domaine non encore implémentées.

**Séparation USER APP / BACK OFFICE** : arborescence de routes distincte —
`src/app/(user)/` (groupe de routes, racine `/`) pour l'application utilisateur,
`src/app/admin/` (segment réel, préfixe `/admin`) pour le Back Office — chacun avec son propre `layout.tsx` montant `<Shell variant="…">`. Voir `docs/DECISIONS.md` ADR-011 pour le détail et les alternatives écartées.

Toutes les routes principales existent avec un état « Bientôt disponible », y compris le tableau de bord (`/` et `/admin`) — aucune donnée financière n'est affichée, conformément au Prompt 03.

## 15. Identity (Prompt 04)

Domaine implémenté dans `src/domains/identity/` (Server Actions et requêtes) + `src/lib/supabase/` (clients) + `supabase/migrations/0001_identity.sql` (schéma).

- **Authentification** : Supabase Auth (email + mot de passe). Voir `docs/DECISIONS.md` ADR-013/ADR-014 pour le choix et le report du téléphone/SMS.
- **Schéma de données** :
  - `identity_profiles` — extension du profil (naminto_id, nom légal, statut, langue préférée), créée automatiquement à l'inscription par le trigger `handle_new_user` (lit `raw_user_meta_data`).
  - `pin_credentials` — PIN Naminto.Ex haché (bcrypt), verrouillage après 5 échecs / 15 min. **Aucune policy RLS de lecture** : le hash n'est jamais lu côté client, même par son titulaire.
  - `devices` — appareils identifiés par un cookie httpOnly opaque (`nx_device_id`), pas de fingerprinting technique.
  - `security_events` — historique append-only, écrit uniquement via le client `service_role`, lecture seule pour le titulaire.
- **Clients Supabase** (`src/lib/supabase/`) : `client.ts` (navigateur), `server.ts` (Server Components/Actions, RLS), `admin.ts` (`service_role`, protégé par le paquet `server-only` — ne compile pas si importé côté client).
- **Parcours construits** : inscription, confirmation par e-mail (`/auth/confirm`), connexion, déconnexion, mot de passe oublié + réinitialisation, création/changement du PIN (redirection automatique si non défini), consultation et révocation des appareils, historique de sécurité.
- **Protection des routes** : `src/proxy.ts` (voir ADR-016) exige une session valide pour tout ce qui n'est pas `/login`, `/register`, `/reset-password`, `/auth/*`, `/design-system`. **`/admin` n'a pas encore de vérification de rôle** — RBAC prévu au Prompt 23.
- **Protections de sécurité** : verrouillage du PIN après 5 échecs, journal de sécurité (`security_events`) pour connexion réussie/échouée, nouvel appareil, changement de mot de passe/PIN, révocation d'appareil, déconnexion. Le rate limiting sur mot de passe s'appuie sur les protections natives de Supabase Auth (aucune couche applicative additionnelle).
- **Non couvert à ce stade** (voir `docs/DECISIONS.md`, TODO_DECISION) : vérification téléphone/SMS, biométrie/WebAuthn, RBAC Back Office, step-up MFA explicite sur nouvel appareil (actuellement journalisé mais non bloquant).

## 16. User Profile + KYC Foundation (Prompt 05)

Domaine implémenté dans `src/domains/user/`, sur la même table `identity_profiles` que le domaine Identity (voir `docs/DECISIONS.md` ADR-017 pour la justification).

- **Schéma** (`supabase/migrations/0002_user_profile.sql`) : ajout de `kyc_status` (`unverified | pending | verified | rejected | requires_action`), `preferred_currency`, `notifications_enabled`, `sound_enabled` à `identity_profiles`.
- **Protection KYC** : trigger `protect_privileged_identity_columns` — `kyc_status`, `status` et `phone_verified` ne sont modifiables que par le client `service_role`, quelle que soit la policy RLS d'update. Vérifié empiriquement par un appel REST direct (voir ADR-018).
- **Page `/settings`** (`src/app/(user)/settings/`) : section Profil (naminto_id, nom légal, e-mail, téléphone — lecture seule), section KYC (badge de statut + rappel du seuil de vérification renforcée à 200 000 FCFA, aucune action de vérification réelle), section Préférences (langue, devise, notifications, sons) via `updatePreferencesAction`.
- **Audit** : les changements de préférences émettent un événement `preferences_updated` dans `security_events` (réutilise le mécanisme d'audit du domaine Identity plutôt que d'en créer un second).
- **Nouveau composant Design System** : `Switch` (`@radix-ui/react-switch`), ajouté à `/design-system` et utilisé pour les préférences booléennes.
- **Non couvert à ce stade** : intégration d'un fournisseur KYC réel (le statut reste `unverified` pour tous les comptes), changement de numéro de téléphone ou de nom légal (champs en lecture seule), gestion des bénéficiaires/contacts (non mentionnée explicitement dans le Prompt 05 officiel — reportée sans decision à prendre pour l'instant).

## 17. Linked Accounts (Prompt 06)

Domaine implémenté dans `src/domains/accounts/`, page `/accounts` (`src/app/(user)/accounts/`).

- **Schéma** (`supabase/migrations/0003_accounts.sql`, corrigé par `0004_accounts_reconnect.sql`) : `linked_accounts` (provider, external_reference, status, capabilities, consent_status, timestamps). Index unique **partiel** sur (user_id, provider, external_reference) excluant les lignes déliées, pour permettre la reconnexion sans dupliquer l'historique.
- **Statuts** : `active | connection_expired | verification_required | suspended | unlinked | provider_unavailable` (repris de la section 10 de l'architecture générale). La déliaison est un soft-delete (`status = 'unlinked'`, `consent_status = 'revoked'`) — jamais une suppression physique.
- **Fournisseurs préparés** (`src/domains/accounts/providers.ts`) : Orange, MTN, Moov, Wave, carte prépayée — avec capacités statiques provisoires (`balance`, `transfer`, `receive`), destinées à devenir dynamiques via le registre d'adapters du Provider Gateway (Prompt 07).
- **Aucune fausse intégration financière** (voir `docs/DECISIONS.md` ADR-020) : le flux de liaison affiche un avertissement explicite « Démonstration — aucune connexion réelle » et un écran de consentement (ce que Naminto.Ex pourra consulter / faire / ne fera jamais). Aucun solde simulé — chaque carte affiche « Solde indisponible » plutôt qu'un chiffre inventé. Aucun PIN ni identifiant fournisseur sensible n'est demandé ; la référence externe est toujours masquée à l'affichage.
- **Audit** : `account_linked`, `account_reconnected`, `account_unlinked` journalisés dans `security_events` (même mécanisme que les domaines Identity et User).
- **Non couvert à ce stade** : toute connexion réelle à un fournisseur (bloquant jusqu'au Prompt 07), synchronisation de solde, détection automatique d'expiration de connexion (`connection_expired`, `provider_unavailable` — nécessitent l'Availability Engine du Prompt 47).

## 18. Provider Gateway (Prompt 07)

`src/domains/providers/` — le cœur financier de Naminto.Ex ne dépend que de l'interface `ProviderAdapter`, jamais d'un fournisseur concret.

- **Interface** (`types.ts`) : `linkAccount`, `getBalance`, `transfer`, `receive`, `getTransactionStatus`, `cancelTransaction`, `refund`, `verifyAndParseWebhook`, `healthCheck`. Chaque adapter expose un `mode` (`REAL | SANDBOX | MOCK | UNAVAILABLE`) — jamais `REAL` tant qu'aucune API fournisseur n'est réellement connectée.
- **Adapters SANDBOX** (`sandbox/`) : une fabrique générique `createSandboxAdapter()` porte la logique de simulation (soldes en mémoire, idempotence par clé, échec si solde insuffisant) ; `orange.ts`, `mtn.ts`, `moov.ts`, `wave.ts`, `card.ts` ne fournissent que leur configuration (voir `docs/DECISIONS.md` ADR-022 pour la justification — évite de dupliquer la logique 5 fois).
- **Provider Registry** (`registry.ts`) : `getProviderAdapter(provider)` résout l'adapter enregistré. Ajouter un fournisseur = un fichier de config + un `registerAdapter()`, jamais de modification du cœur.
- **Webhook générique** : `POST /api/webhooks/[provider]` (route publique, voir `docs/DECISIONS.md` ADR-024) — démontre le contrat, sans persistance tant que le domaine Transaction (Prompt 08) et les Webhooks (Prompt 25) ne sont pas construits.
- **Accounts rebranché** (voir ADR-023) : la liaison de compte (Prompt 06) passe désormais par `adapter.linkAccount()`, et `/accounts` affiche un solde SANDBOX réel (simulé) au lieu d'un message d'indisponibilité — toujours clairement étiqueté SANDBOX.
- **Non couvert à ce stade** : tout adapter `REAL` (nécessite les identifiants et contrats de chaque fournisseur — hors périmètre technique, décision produit/business), vérification de signature webhook réelle et persistance (Prompt 25), utilisation de `transfer`/`receive`/`cancelTransaction`/`refund` par un flux utilisateur (attend le domaine Transaction et le Payment Orchestrator, Prompts 08-09).

## 19. Domain Transaction (Prompt 08)

`src/domains/payments/` — modèle central de transaction et sa State Machine, reprenant exactement la table de transitions documentée (aucune transition inventée).

- **State Machine** (`transaction-status.ts`, pur, sans dépendance) : 14 statuts (`created` → `validating` → `authentication_required` → `authenticated` → `processing` → `provider_confirmed` → `settled`, plus les états terminaux `failed`, `rejected`, `expired`, `cancelled`, `reversed`, `refunded`, `disputed`). `canTransition`/`assertTransition`/`isTerminalStatus` exposés et testés exhaustivement (`transaction-status.test.ts`, 9 tests couvrant chaque paire statut×statut).
- **Schéma** (`supabase/migrations/0005_transactions.sql`) : `transactions` (sender/recipient, source/destination, provider, amount/currency/fee/total, reference `NEX-XXXXXXXX`, idempotency_key, status) et `transaction_status_events` (historique append-only de chaque transition). **Aucune policy RLS d'écriture** sur les deux tables — lecture seule pour les participants, toute mutation passe par `transactions.ts` (`service_role`).
- **Défense en profondeur** : un trigger Postgres (`check_transaction_status_transition`) revalide la même State Machine côté base, en miroir du TypeScript — voir `docs/DECISIONS.md` ADR-026.
- **Service** (`transactions.ts`) : `createTransaction` (idempotente par clé), `transitionTransaction` (applique `assertTransition` avant toute écriture), `getTransactionById`. Aucune Server Action générique « changer le statut » n'est exposée à un formulaire — conforme à l'exigence explicite du Prompt 08.
- **Non couvert à ce stade** : résolution d'un statut `disputed` (ADR-027).

## 20. Payment Orchestrator (Prompt 09)

`src/domains/payments/orchestrator.ts` + `orchestrator-steps/` — assemble tous les domaines précédents (Identity, Transaction, Provider Gateway) en un pipeline unique. Premier flux utilisateur réel créant des transactions (aucun n'existait avant ce prompt).

- **Flux** : Request → Validation → Routing → Fee → Transaction (créée) → Authentication → Risk → Compliance → Limits → Provider Gateway → Ledger → Notification → Reconciliation. Routing et Fee sont résolus avant la création de la transaction (voir ADR-029/033 : le Fee Engine du Prompt 10 a besoin de `provider`, connu seulement après Routing). Chaque étape vit dans son propre module (`orchestrator-steps/{validate,authenticate,risk,compliance,limits,fee,routing,execute-provider,ledger,notification,reconciliation}.ts`) — indépendante et remplaçable sans toucher `orchestrator.ts`.
- **Étapes réelles dès ce prompt** : Validation (structurelle), Routing, Authentication (réutilise `verifyPinForUser` du domaine Identity — extrait de `verifyPinAction` pour ne pas dupliquer la logique de verrouillage), Compliance (seuil KYC 200 000 FCFA, seule règle documentée), Fee (délègue entièrement au Fee Engine, Prompt 10) et Provider Gateway (réel, via le Provider Registry du Prompt 07).
- **Étapes STUB** (voir `docs/DECISIONS.md` ADR-028) : Risk (Prompt 17), Limits (Prompt 11), Ledger (Prompt 12), Reconciliation (Prompt 24) — présentes dans le pipeline avec leur signature finale, ne rejettent/ne persistent rien pour l'instant. Notification (Prompt 20) est désormais réelle — voir section 31.
- **Classification d'erreur** : `OrchestratorError` avec l'un des 8 codes exigés (`VALIDATION_ERROR`, `AUTH_ERROR`, `RISK_REJECTION`, `COMPLIANCE_REJECTION`, `LIMIT_ERROR`, `PROVIDER_ERROR`, `TIMEOUT`, `SYSTEM_ERROR`). Chaque erreur transitionne la transaction vers l'état d'échec approprié (`rejected`/`cancelled`/`failed`/`expired` selon la phase — voir `failureStatusFor` dans `orchestrator.ts`). Une erreur de Routing (compte lié introuvable/non actif) est classifiée `VALIDATION_ERROR` et survient avant toute création de transaction.
- **Retries sûrs** : `idempotencyKey` identique ⇒ `createTransaction` renvoie la transaction déjà créée ; si elle a déjà quitté les statuts « en cours » (`isInFlight`, voir ADR-030 — distinct de `isTerminalStatus` du Prompt 08), aucune étape à effet de bord (PIN, appel fournisseur) n'est rejouée.
- **Correction Provider Gateway associée** : `receive()` créditait par erreur comme `transfer()` (débit) dans les adapters SANDBOX — corrigé (ADR-031), avec une suite de tests dédiée qui n'existait pas au Prompt 07.
- **Non couvert à ce stade** : aucune UI n'appelle encore l'orchestrateur (attend Send Money, Prompt 13) ; retry automatique interne sur `PROVIDER_ERROR`/`TIMEOUT` (seule la sécurité du rejeu externe est implémentée) ; virement Naminto.Ex → Naminto.Ex pur (portefeuille à portefeuille) route correctement sans fournisseur mais ne crédite encore aucun solde réel côté destinataire (attend le Ledger, Prompt 12).

## 21. Fee Engine (Prompt 10)

`src/domains/payments/fee-engine/` — domaine indépendant, entièrement piloté par la configuration en base. Aucune règle tarifaire codée en dur dans l'UI ni dans le cœur financier.

- **Schéma** (`supabase/migrations/0006_fee_rules.sql`) : `fee_rules`, chaque colonne optionnelle (`country`, `currency`, `min_amount`/`max_amount`, `source_type`, `destination_type`, `provider`, `transaction_type`, `user_tier`) valant NULL comme joker. Une seule règle semée : le taux de repli 3,5 % XOF déjà documenté, désormais une donnée configurable plutôt qu'une constante TypeScript.
- **Correspondance** (`match-rule.ts`, pur, testé unitairement) : une règle correspond si toutes ses dimensions contraintes égalent la requête ; parmi les règles qui correspondent, la plus spécifique (le plus de dimensions contraintes) est retenue.
- **Calcul** (`calculate-fee.ts`) : `fee = amount × rate_percent + flat_fee` ; `feePayer` vient de la règle sauf si l'appelant le surcharge explicitement (`feePayerOverride`, reflète le choix utilisateur « qui paie les frais » — architecture générale, section 28). Retourne `{ fee, senderDebit, recipientCredit, feePayer, ruleId }` exactement comme exigé par le Prompt 10.
- **Branché sur l'orchestrateur** : `orchestrator-steps/fee.ts` délègue entièrement au Fee Engine (voir ADR-033 pour la réorganisation Routing → Fee que cela a nécessitée).
- **Accès** : aucune policy RLS cliente sur `fee_rules` — lecture/écriture réservées au `service_role`, faute d'UI Back Office de tarification (Prompt 22).
- **Non couvert à ce stade** : `user_tier` (colonne prête, aucun palier utilisateur réel côté User) ; barème dégressif par palier de montant (la table le permet, aucune règle de ce type n'est encore saisie) ; UI de gestion des règles (Prompt 22, Back Office Pricing).

## 22. Limit Engine (Prompt 11)

`src/domains/payments/limit-engine/` — domaine indépendant, même principe de configuration que le Fee Engine, réutilise l'utilitaire partagé `shared/pick-most-specific.ts` (voir `docs/DECISIONS.md` ADR-035).

- **Schéma** (`supabase/migrations/0007_limit_rules.sql`) : `limit_rules`, quatre types (`per_transaction_amount`, `daily_amount`, `monthly_amount`, `frequency_count`), dimensions de correspondance jokers (`country`, `currency`, `kyc_status`, `provider`, `transaction_type`, `user_tier`). **Table vide au départ** — aucune valeur de limite n'est documentée dans les sources du projet ; absence de règle = absence de contrainte, jamais un refus (voir ADR-036).
- **Usage réel** (`usage-queries.ts`) : lit `transactions` pour calculer le cumul journalier/mensuel (période calendaire UTC) ou la fréquence (fenêtre glissante configurable) de l'utilisateur, en excluant les statuts qui ne représentent jamais un usage réel (`failed`/`rejected`/`cancelled`/`expired`).
- **Décision explicable** : `checkLimits` retourne `{ allowed, violations[] }`, chaque violation détaillant la règle, le plafond et l'usage projeté — jamais un booléen opaque.
- **Branché sur l'orchestrateur** : `orchestrator-steps/limits.ts` délègue entièrement au Limit Engine ; s'exécute exclusivement côté serveur (aucun blocage frontend uniquement, exigence explicite du Prompt 11).
- **Accès** : aucune policy RLS cliente sur `limit_rules` — `service_role` uniquement, faute d'UI Back Office (Prompt 22).
- **Non couvert à ce stade** : **aucune valeur de limite réelle configurée** (bloquant avant mise en production) ; `user_tier` (même limitation que le Fee Engine) ; UI de gestion des règles.

## 23. Ledger (Prompt 12)

`src/domains/payments/ledger/` — comptabilité en partie double, append-only, remplaçant le STUB `writeLedgerEntries` posé au Prompt 09. Aucune règle métier de comptabilité côté orchestrateur : `orchestrator-steps/ledger.ts` délègue entièrement au domaine.

- **Schéma** (`supabase/migrations/0008_ledger.sql`) : `fee_payer` ajouté à `transactions` (déterminé par le Fee Engine à la création, Prompt 10 — nécessaire pour dériver qui est débité) ; `ledger_accounts` (comptes internes : `user_wallet`, `provider_suspense`, `fee_revenue`, `external_suspense` — index unique sur owner_type/owner_id/provider/currency) ; `ledger_entries` (transaction_id, account_id, kind `settlement|reversal|refund`, direction `debit|credit`, montant `> 0`, devise, référence).
- **Immuabilité réelle** : trigger `forbid_ledger_entries_mutation` bloque UPDATE et DELETE sur `ledger_entries`, **y compris pour `service_role`** — toute correction doit être une nouvelle écriture (`reversal`/`refund`), jamais une réécriture. Conséquence assumée : une transaction de test qui atteint le règlement garde définitivement ses écritures en base, même en environnement de test (voir ADR-038).
- **Comptes** (`accounts.ts`) : `getOrCreateLedgerAccount` résout un compte à partir d'une référence logique (owner_type/owner_id/provider/currency), le crée s'il n'existe pas ; idempotent via l'index unique (relit en cas de course de création concurrente).
- **Écritures** (`record-entries.ts`) : `writeBalancedEntries` est le seul point d'écriture — rejette un lot déséquilibré (Σdébits ≠ Σcrédits), multi-devise, ou contenant un montant ≤ 0, avant toute insertion (défense en profondeur, la contrainte `amount > 0` existe aussi côté base).
  - `recordSettlement(transactionId)` dérive les écritures de règlement à partir de la transaction : débit du compte source (`sender_user_id` si `naminto_wallet`, sinon compte de transit du fournisseur), crédit du compte destination (`recipient_user_id`, compte de transit fournisseur, ou compte de transit externe générique selon `destination_type`), crédit du compte `fee_revenue` si des frais existent. Idempotent (rejouer ne crée pas de deuxième lot).
  - `recordReversal`/`recordRefund(transactionId)` produisent des écritures miroir (débit/crédit inversés) à partir du règlement existant — échouent si aucun règlement n'a été enregistré. Idempotents chacun indépendamment.
- **Accès** : lecture seule cliente, restreinte au propre portefeuille de l'utilisateur (`owner_type = 'user_wallet' AND owner_id = auth.uid()`) sur les deux tables ; aucune policy d'écriture cliente.
- **Non couvert à ce stade** : déclenchement de `recordReversal`/`recordRefund` depuis un flux utilisateur ou administratif réel (aucun écran de litige/remboursement n'existe encore — attend un prompt ultérieur) ; solde de portefeuille consultable par l'utilisateur (les écritures existent, aucune UI ne les agrège encore — `/admin/ledger` reste « Bientôt disponible »).

## 24. Send Money (Prompt 13)

`src/app/(user)/send/` (UI) + `src/domains/payments/actions.ts` (Server Actions) — premier flux utilisateur réel appelant le Payment Orchestrator (Prompts 09-12). Aucune logique financière côté client : chaque montant affiché avant confirmation vient d'un appel serveur au Fee Engine, jamais d'un calcul local.

- **Parcours** (`send-money-wizard.tsx`, assistant à 5 étapes) : Bénéficiaire (interne Naminto.Ex par identifiant, ou externe via un compte lié) → Montant + Frais (aperçu en direct) + Payeur des frais → Authentification (PIN) → Récapitulatif (Montant, Frais, Total débité, Montant reçu, Bénéficiaire, Réseau — tous exigés par le Prompt 13) → Confirmation explicite → Exécution → Reçu. Risk/Limits n'ont pas d'écran dédié : ils s'exécutent à l'intérieur du Payment Orchestrator au moment de la confirmation, comme le prévoit le diagramme du Prompt 09.
- **Deux combinaisons supportées**, les seules couvertes bout-en-bout par l'orchestrateur (Prompts 09-11) : `naminto_wallet → naminto_wallet` (bénéficiaire résolu par `findRecipientByNamintoId`, Identity) et `linked_account → external` (débit d'un compte lié du sender, bénéficiaire externe identifié par un numéro en texte libre). Voir `docs/DECISIONS.md` ADR-041 pour les combinaisons volontairement non exposées dans cette UI.
- **`feePayerOverride` enfin branché** : le choix « qui paie les frais ? » de l'écran Montant atteint désormais réellement le Fee Engine (`PaymentRequest.feePayerOverride`, propagé par `orchestrator-steps/fee.ts`) — jusqu'ici la règle par défaut s'appliquait toujours, faute d'appelant (voir ADR-034, Prompt 10, et ADR-041).
- **Bénéficiaire externe** (`supabase/migrations/0009_send_money.sql`) : `transactions.destination_external_reference` (texte libre) — distinct de `destination_reference` (uuid, réservé aux comptes liés) puisqu'un bénéficiaire externe n'a par définition aucune ligne `linked_accounts`. Bug corrigé au passage : `destination_reference` valait toujours `destinationLinkedAccountId`, jamais renseigné pour une destination externe (voir ADR-041).
- **QR** : mentionné dans le parcours source, mais aucune capture caméra n'est implémentée à ce stade (non testable dans cet environnement) — l'identifiant Naminto.Ex se saisit en texte pour l'instant, marqué « bientôt disponible » dans l'UI. La règle « un scan QR ne doit jamais exécuter automatiquement » est de toute façon respectée : aucune action ne s'exécute sans passer par le Récapitulatif et sa confirmation explicite.
- **Double clic / rejeu** : l'`idempotencyKey` (UUID) est générée une seule fois côté client à l'entrée du Récapitulatif et conservée pour tout rejeu (double clic sur Confirmer, retry après erreur) — jamais régénérée tant que l'utilisateur ne recommence pas un nouvel envoi depuis le début.
- **Vérification du bénéficiaire** : `findRecipientByNamintoId` (`src/domains/identity/queries.ts`) résout un `naminto_id` en nom affichable via `service_role` (RLS restreint `identity_profiles` au titulaire) — ne renvoie jamais que le strict nécessaire à la confirmation (jamais le téléphone, le statut KYC…).
- **Vérifié manuellement contre le vrai projet Supabase** : envoi interne réglé de bout en bout (statut `settled`, écritures Ledger équilibrées vérifiées en base), aperçu de frais réactif au changement de payeur, état vide pour l'étape « compte lié » sans compte actif, échec PIN affichant le message spécifique (`pin.error.invalid`) plutôt qu'une erreur générique.
- **Non couvert à ce stade** : envoi `naminto_wallet → external` ou `linked_account → naminto_wallet` (combinaisons non exercées par l'orchestrateur existant — TODO_DECISION, voir ADR-041) ; scan QR réel ; page `/history` (toujours « Bientôt disponible », Prompt à venir).

## 25. Receive + Request Money (Prompt 14)

`src/domains/payments/money-requests/` + `src/app/(user)/{receive,request,pay}/` — Receive Money (passif, identité déjà connue) et Request Money (actif, nouveau domaine `money_requests`).

- **Receive Money** (`/receive`) : aucune nouvelle table — affiche `identity_profiles.naminto_id`/`legal_name` (Prompt 04) et un QR non signé encodant l'identifiant, pour alimenter la recherche « Un utilisateur Naminto.Ex » déjà construite par Send Money (Prompt 13).
- **Schéma** (`supabase/migrations/0010_money_requests.sql`) : `money_requests` (requester_user_id, `token` non devinable, amount/currency/note, status `pending|fulfilled|cancelled|expired`, `fulfilled_transaction_id`, `expires_at`). Seule policy RLS : lecture par le demandeur de ses propres lignes — aucune policy publique par jeton (voir ADR-042), aucune policy d'écriture cliente.
- **Statut effectif calculé, jamais physiquement écrit** : `effectiveStatus()` (`money-requests/types.ts`, pur) traite une ligne `pending` dont `expires_at` est dépassé comme `expired` à la lecture — pas de job planifié pour réécrire les lignes expirées (hors périmètre de ce prompt).
- **Cycle de vie** (`create.ts`, `cancel.ts`, `fulfill.ts`) : `createMoneyRequest` génère un jeton `crypto.randomUUID()` et une échéance de 7 jours (ADR-042, TODO_DECISION si une autre durée est requise) ; `cancelMoneyRequest` vérifie propriétaire + statut effectif `pending` ; `fulfillMoneyRequest` délègue entièrement au Payment Orchestrator (`naminto_wallet → naminto_wallet`, comme Send Money) avec un `idempotencyKey` déterministe (`money-request-${token}`) puis marque la demande `fulfilled` de façon conditionnelle (`.eq('status','pending')`, pour ne jamais écraser un règlement concurrent). Rejeu par le même payeur : idempotent, renvoie la transaction déjà créée sans rappeler l'orchestrateur.
- **Pages** : `/request` (création + liste de ses propres demandes), `/request/[id]` (détail réservé au demandeur — vérification de propriété manuelle, `getMoneyRequestById` passe par service_role), `/pay/[token]` (lien de partage public — protégé par la session Naminto.Ex comme le reste de l'app, pas par une policy RLS ; résolution du jeton et du nom du demandeur via `service_role`, `getPublicProfile` n'exposant que naminto_id/nom légal).
- **QR** (`src/lib/qr.ts`, `qrcode` npm) : généré côté serveur (jamais dans le bundle client), rendu par le composant Design System `QrCode`. Non signé — voir Prompt 15 (QR Engine) pour le format signé/typé (`BENEFICIARY`/`REQUEST`/`PAYMENT_REQUEST`/`PREFILLED_PAYMENT`). Aucune information secrète encodée (identifiant public ou lien de partage déjà partageable).
- **Origine absolue fiable** (`src/lib/request-origin.ts`) : le lien de partage nécessitait l'origine de la requête ; `headers().get("origin")` (utilisé par erreur dans une première version, repéré en testant réellement le lien affiché) est vide sur une navigation GET classique — seul `Host`/`x-forwarded-host` est systématiquement présent.
- **Vérifié manuellement contre le vrai projet Supabase** : création → détail → paiement par un second utilisateur réel (statut `fulfilled`, transaction `settled`, `fulfilled_transaction_id` correct) → réaffichage `Réglée` sans formulaire de paiement ; annulation ; auto-paiement bloqué (« C'est votre propre demande »).
- **Non couvert à ce stade** : scan QR caméra (Prompt 15) ; job d'expiration physique (`expired` reste calculé) ; `naminto_wallet → external` / `linked_account → naminto_wallet` pour le règlement d'une demande (mêmes limites que Send Money, ADR-041).

## 26. QR Engine (Prompt 15)

`src/domains/qr-engine/` + `src/app/(user)/qr/[encoded]/` — formalise et remplace les QR non signés posés au Prompt 14 (identifiant `/receive`, lien `/pay/[token]`) par des payloads signés, typés, vérifiables côté serveur. Point d'entrée unique du cycle obligatoire : decode → validate → resolve → display → confirm → authenticate → execute — jamais un simple « scan → execute ».

- **Signature** (`sign.ts`) : HMAC-SHA256 (`QR_SIGNING_SECRET`, généré localement, jamais commité — voir `.env.example`), format compact `<payload base64url>.<signature base64url>`, intégrable tel quel dans une URL (`/qr/<encoded>`) donc dans un QR. `verifyQr` vérifie la signature en temps constant (`timingSafeEqual`), la forme du payload selon son type, puis l'expiration — dans cet ordre, avant même de savoir si l'objet référencé existe encore réellement (rôle distinct de `resolve.ts`).
- **Quatre types** (`types.ts`), interprétation nécessaire faute d'élaboration dans les documents source au-delà des noms — voir ADR-043 :
  - `BENEFICIARY` — identifie un utilisateur Naminto.Ex (`naminto_id`), échéance longue (30 jours). Généré par `/receive` (remplace l'ancien QR en clair du Prompt 14).
  - `PAYMENT_REQUEST` — instantané enrichi d'une demande d'argent (`money_requests`, Prompt 14) : montant, devise, demandeur, pour un affichage immédiat — toujours revérifié contre la base à la résolution. Généré par `/request/[id]` (la colonne « lien de partage » reste le lien court `/pay/[token]` non signé, déjà protégé par jeton de capacité — ADR-042 ; seule l'image QR utilise désormais le format signé).
  - `REQUEST` — référence légère (jeton seul) vers le même objet `money_requests`. Entièrement pris en charge par le moteur (decode/validate/resolve, redirection vers `/pay/[token]`) mais **aucune UI de ce dépôt ne le génère encore** — réservé pour un usage futur plus contraint en taille.
  - `PREFILLED_PAYMENT` — paiement à montant fixe vers un bénéficiaire précis, **sans ligne `money_requests`** (aucun cycle de vie propre, échéance courte de 24 h) : tout l'état tient dans le payload signé. Généré par `/receive` (section « Demander un montant précis »), exécuté via `/qr/[encoded]` (seul type sans page dédiée préexistante — les trois autres réutilisent Send Money ou `/pay/[token]`, jamais dupliqués).
- **Pipeline unique** (`/qr/[encoded]/page.tsx`) : decode + validate systématiques ; `BENEFICIARY` résolu puis redirigé vers `/send?to=<namintoId>` (Send Money, Prompt 13, étend son wizard pour démarrer directement à l'étape Montant avec le bénéficiaire déjà vérifié côté serveur — jamais fait confiance au seul paramètre d'URL, revérifié via `findRecipientByNamintoId`) ; `REQUEST`/`PAYMENT_REQUEST` redirigés vers `/pay/[token]` (Prompt 14, qui possède déjà tout le pipeline display → confirm → authenticate → execute) ; `PREFILLED_PAYMENT` seul type affiché et exécuté directement ici, avec re-vérification serveur de la signature avant tout appel à l'orchestrateur (`payPrefilledQrAction` ne fait jamais confiance à un payload renvoyé tel quel par le client).
- **Idempotence sans ligne persistée** : `PREFILLED_PAYMENT` n'ayant pas de `money_requests.id` à conditionner, `idempotencyKey` est dérivée d'un hash (QR brut + id du payeur) — un même payeur qui rejoue la confirmation obtient toujours la même transaction ; deux payeurs différents scannant le même QR statique obtiennent chacun la leur.
- **QR non signés du Prompt 14 rendus obsolètes** : `/receive` et `/request/[id]` génèrent désormais leurs QR via ce moteur plutôt que via un encodage brut (naminto_id en clair, lien nu) — voir ADR-043.
- **Vérifié manuellement contre le vrai projet Supabase** : QR `PREFILLED_PAYMENT` généré puis payé par un second utilisateur réel (statut `settled`, montant/frais corrects) ; QR `BENEFICIARY` réel scanné (navigué directement) → atterrit dans Send Money avec bénéficiaire déjà vérifié ; QR `PAYMENT_REQUEST` → redirection correcte vers `/pay/[token]` affichant le statut réel ; QR expiré et QR à signature falsifiée tous deux rejetés avec un message distinct.
- **Non couvert à ce stade** : lecture caméra réelle (même limite qu'au Prompt 13/14, non testable dans cet environnement — un QR généré par ce moteur reste néanmoins lisible par n'importe quelle application d'appareil photo standard, puisqu'il encode une URL ordinaire) ; UI de génération pour `REQUEST` ; rotation du secret de signature (toute rotation invalide tous les QR déjà émis, aucune procédure de rotation à chaud construite).

## 27. Transaction History + Receipts (Prompt 16)

`src/domains/payments/history/` + `src/app/(user)/history/` — aucune nouvelle table : lit exclusivement `transactions`, `transaction_status_events` (Prompt 08) et `ledger_entries` (Prompt 12), déjà la source de vérité.

- **Liste, recherche, filtres** (`/history`) : formulaire `<form method="GET">` — recherche par référence (`ILIKE`, insensible à la casse et au préfixe `NEX-`), statut, sens (envoyé/reçu), plage de dates. Aucun JavaScript requis pour filtrer : les filtres sont l'état de l'URL elle-même (partageable, revenir en arrière fonctionne), le Server Component relit `searchParams` et refait la requête. Pagination par page de 20 (`.range()`), toujours dans le même sens.
- **`listTransactions`/`getTransactionByReference`/`getTransactionTimeline`** (`queries.ts`) : passent par le client RLS (`transactions_select_participant`, `transaction_status_events_select_participant` — Prompt 08), jamais `service_role` : la policy fait déjà exactement le filtrage nécessaire, et **chaque transaction est retrouvable par sa référence** exacte via `getTransactionByReference` sans dépendre de la fenêtre de pagination affichée.
- **Détail** (`/history/[reference]`) : montant, frais, qui paie les frais, statut, horodatages, référence fournisseur. **Débité de l'expéditeur / Crédité au destinataire** recalculés avec exactement la même formule que le Ledger (`recordSettlement`, Prompt 12) plutôt que lus depuis la colonne `transactions.total` — voir ADR-044 (bug trouvé en construisant ce prompt : `total` vaut toujours `amount + fee`, y compris quand `fee_payer = 'recipient'`, et ne reflète donc pas fidèlement ce qui a été réellement débité/crédité).
- **Timeline** : directement `transaction_status_events` (append-only depuis le Prompt 08), affichée telle quelle — jamais reconstruite ou approximée.
- **Reçu** : section dédiée de la page détail (bouton Imprimer, `window.print()`, styles `print:` pour masquer la navigation) — cohérent avec le Ledger par construction (mêmes champs que le récapitulatif), et affiche un badge « Écriture comptable confirmée dans le Ledger » **seulement** quand une écriture réelle est visible (`getMyLedgerEntriesForTransaction`, RLS `ledger_accounts_select_own_wallet` scopée à `user_wallet` — absente pour le côté d'une transaction passée par un compte lié, absence normale, pas une anomalie signalée à tort). Jamais d'information inventée : un profil de contrepartie introuvable affiche « — », jamais un nom substitué (`resolveCounterparty`).
- **Aucun nom inventé** : `resolveCounterparty` (testé unitairement, 6 cas) dérive l'« autre partie » du point de vue du consultant — utilisateur Naminto.Ex réel (résolu via `getPublicProfile`, Prompt 15), référence externe telle quelle, ou « mon compte lié » quand la destination est un compte du titulaire lui-même (jamais présenté comme une autre personne).
- **Vérifié manuellement contre le vrai projet Supabase** : liste affichant les transactions réelles des Prompts 13-15 avec la bonne contrepartie ; recherche partielle insensible à la casse (`fdfa071a` → `NEX-FDFA071A`) ; détail avec débit/crédit corrects (750 + 26,25 = 776,25 XOF pour `fee_payer = sender`) et timeline complète (7 transitions) ; reçu avec confirmation Ledger visible ; page « Transaction introuvable » pour une référence inexistante ou non autorisée.
- **Non couvert à ce stade** : export du reçu en PDF (impression navigateur uniquement) ; recherche plein texte sur le motif/la note ; filtres combinés sauvegardés.

## 28. Risk Engine (Prompt 17)

`src/domains/payments/risk-engine/` — remplace le STUB `checkRisk` posé au Prompt 09 (ADR-028), qui renvoyait toujours `LOW` sans jamais analyser quoi que ce soit. Lecture seule stricte : **le Risk Engine n'écrit jamais dans le Ledger**, ni nulle part ailleurs — il fournit une décision au Payment Orchestrator, qui seul agit dessus.

- **Sept signaux indépendants** (`assess-risk.ts`, chacun pur et testé isolément) couvrant exactement les dimensions exigées : `amount` (paliers XOF), `frequency` (réutilise `getFrequencyUsage` du Limit Engine, Prompt 11 — jamais dupliqué), `history` (nombre de transactions déjà réglées à vie, proxy de maturité du compte), `device` (statut réel de l'appareil, Identity/Prompt 04 — voir ci-dessous), `beneficiary` (nouveau bénéficiaire pour un montant significatif), `behavior` (montant très supérieur à la moyenne habituelle de l'utilisateur), `context` (sortie vers un bénéficiaire externe pour un montant élevé).
- **Décision structurée** : chaque signal porte un `code`, un `level` (`LOW`/`MEDIUM`/`HIGH`) et un `reason` textuel + `details` — jamais une raison opaque. La décision globale (`aggregateRiskDecision`) retient le signal le plus sévère, **sans règle de composition** (plusieurs signaux MEDIUM simultanés ne deviennent jamais HIGH à eux seuls) — voir ADR-045 pour la justification (ce rôle revient au Fraud Engine, Prompt 18).
- **Seuils en constantes de code, pas configurables en base** — à la différence du Fee Engine (Prompt 10) et du Limit Engine (Prompt 11), dont l'énoncé exige explicitement des règles configurables : le Prompt 17 ne le demande pas. Voir ADR-045.
- **Branché sur l'orchestrateur** : `orchestrator.ts` bloque désormais réellement (`RISK_REJECTION`) quand la décision est `HIGH`, avant même Compliance ou Limits (ordre déjà fixé au Prompt 09) — jusqu'ici ce code d'erreur n'était jamais atteignable en pratique.
- **`deviceFingerprint` enfin threadé jusqu'à l'orchestrateur** : `PaymentRequest` n'avait jamais ce champ ; Send Money (Prompt 13), le règlement d'une demande (Prompt 14) et le paiement d'un QR `PREFILLED_PAYMENT` (Prompt 15) le renseignent désormais via `getOrCreateDeviceCookie()` (Identity, Prompt 04) — même cookie httpOnly déjà utilisé à la connexion, aucun nouveau mécanisme de suivi. Absent, il ne pénalise jamais le signal `device` (`LOW`, jamais `MEDIUM` par défaut).
- **Erreurs `RISK_REJECTION`/`LIMIT_ERROR`/etc. enfin classifiées côté Server Actions** : `payMoneyRequestAction` et `payPrefilledQrAction` ne renvoyaient qu'un message générique pour tout code autre que `AUTH_ERROR` — corrigé en réutilisant la même table de correspondance que Send Money (`send.error.*`), trouvé en vérifiant que le blocage s'affichait correctement pour ces deux parcours, pas seulement Send Money.
- **Vérifié manuellement contre le vrai projet Supabase** : envoi de 600 000 XOF réellement bloqué (« Cette opération a été bloquée pour des raisons de sécurité »), transaction persistée en statut `failed` — avant même que Compliance (seuil KYC 200 000 XOF) n'ait eu l'occasion de rejeter pour une autre raison, confirmant l'ordre du pipeline.
- **Non couvert à ce stade** : seuils configurables en base. L'escalade multi-signaux et l'action corrective sur des signaux `MEDIUM` (revue manuelle, step-up) sont désormais couvertes par le Fraud Engine (Prompt 18, section suivante).

## 29. Fraud Engine (Prompt 18)

`src/domains/payments/fraud-engine/` — architecture de règles consommant la décision du Risk Engine (Prompt 17), jamais une nouvelle lecture en base : une fonction pure du contexte déjà calculé. Ferme le TODO explicitement laissé ouvert au Prompt 17 (ADR-045) : « combiner plusieurs signaux modérés en une action... est le rôle du Fraud Engine ».

- **Quatre règles** (`rules.ts`), chacune une donnée autonome — `id`, `description`, `severity` (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`), `condition`, `action` (`ALLOW`/`STEP_UP`/`BLOCK`/`MANUAL_REVIEW`) — évaluées par un moteur générique (`evaluate-fraud.ts`) qui ne connaît aucune règle en particulier. `FRAUD-001` (BLOCK) : fréquence MEDIUM + montant non négligeable, motif classique d'un compte compromis. `FRAUD-002` (MANUAL_REVIEW) : trois signaux Risk MEDIUM ou plus simultanément. `FRAUD-003`/`FRAUD-004` (STEP_UP) : appareil non reconnu + montant significatif, ou nouveau bénéficiaire externe + montant élevé.
- **Décision finale = action la plus restrictive** parmi les règles déclenchées (BLOCK > MANUAL_REVIEW > STEP_UP > ALLOW) — jamais un score. Aucune règle déclenchée ⇒ `ALLOW`, aucune trace d'audit produite (rien d'anormal à consigner).
- **Audit systématique** : chaque règle qui se déclenche produit un `security_events` (`fraud_rule_matched`, Identity/Prompt 04) avec `ruleId`/`severity`/`action`/`description` — le champ « audit » explicitement exigé par le Prompt 18, écrit par l'étape orchestrateur (`orchestrator-steps/fraud.ts`), jamais par le moteur pur lui-même.
- **Deux nouveaux codes `OrchestratorErrorCode`** : `FRAUD_BLOCKED` (action BLOCK) et `MANUAL_REVIEW_REQUIRED` (action MANUAL_REVIEW — réutilisable tel quel par la future revue manuelle de Compliance, Prompt 19, plutôt que dupliqué). `STEP_UP` ne bloque jamais : aucune authentification supplémentaire n'existe dans ce dépôt (biométrie/WebAuthn non implémentées), même traitement que le step-up déjà documenté pour un nouvel appareil à la connexion (Prompt 04) — journalisé, jamais bloquant.
- **Pipeline réordonné : Risk → Compliance → Limits → Fraud**, Fraud en dernier plutôt que juste après Risk — voir ADR-046 (une grosse transaction d'un compte neuf déclenchait presque systématiquement une revue manuelle avant même que Compliance n'ait eu l'occasion de statuer sur son propre critère, cassant un test déjà correct pour une raison sans rapport ; les portes déterministes passent maintenant en premier).
- **Seuils et règles en code, pas configurables en base** — même choix que le Risk Engine (ADR-045) : le Prompt 18 n'exige pas explicitement une configuration en base, contrairement au Fee/Limit Engine.
- **Vérifié manuellement et par 24 tests** (règles pures + bout-en-bout orchestrateur, dont un compte neuf combinant 3 signaux MEDIUM → `MANUAL_REVIEW_REQUIRED`, et 5 opérations rapprochées suivies d'un montant non négligeable → `FRAUD_BLOCKED`) : suite complète (144 tests) toujours au vert, envoi normal réellement exécuté dans le navigateur sans interférence.
- **Non couvert à ce stade** : file d'attente de revue manuelle (aucun écran Back Office ne permet de statuer sur une transaction en `MANUAL_REVIEW_REQUIRED` — Prompt 22+) ; second facteur d'authentification réel pour STEP_UP ; règles configurables en base.

## 30. Compliance Engine (Prompt 19)

`src/domains/payments/compliance-engine/` — remplace le seuil codé en dur `ENHANCED_KYC_THRESHOLD_XOF = 200_000` posé au Prompt 09 par une table `compliance_rules` configurable, exactement le même schéma de pattern que le Fee Engine (Prompt 10) et le Limit Engine (Prompt 11) : dimensions à `NULL` = joker, `pickMostSpecific` (`shared/pick-most-specific.ts`) retient la règle active la plus spécifique.

- **`compliance_rules`** (migration `0011_compliance_rules.sql`) : `rule_type` (`PRODUCT_RULE`/`REGULATORY_RULE`/`CONFIGURATION` — la distinction explicitement exigée par le Prompt 19, purement documentaire pour l'instant, aucune logique ne branche encore dessus), `requirement` (`NONE`/`KYC_STANDARD`/`KYC_ENHANCED`/`MANUAL_REVIEW`), dimensions `country`/`currency`/`source_type`/`destination_type`/`min_amount`/`max_amount`. RLS activée, **aucune politique cliente** — lecture et écriture réservées au `service_role`, même choix que `fee_rules`/`limit_rules`.
- **Règle seedée à l'application de la migration** : une unique `REGULATORY_RULE` XOF, `min_amount = 200 000,01`, `requirement = KYC_ENHANCED` — reproduit exactement la sémantique de l'ancien `amount > 200_000` codé en dur, pour ne casser aucun comportement existant lors de la bascule.
- **`determineRequirement`** (`determine-requirement.ts`) : aucune règle correspondante ⇒ `NONE`, jamais un refus — même principe que le Limit Engine (ADR-036). Retourne toujours `ruleId`/`ruleType`/`description` pour l'audit, même quand `NONE`.
- **`orchestrator-steps/compliance.ts` réécrit** : délègue entièrement à `determineRequirement`, plus aucune comparaison de montant codée dans l'étape orchestrateur. Toute exigence non `NONE` produit un `security_events` (`compliance_requirement_applied`) — audit systématique, avant même de savoir si la transaction sera finalement acceptée ou rejetée. `MANUAL_REVIEW` réutilise tel quel le code `MANUAL_REVIEW_REQUIRED` posé au Prompt 18 (Fraud Engine), plutôt que d'en dupliquer un ; `KYC_STANDARD`/`KYC_ENHANCED` rejettent avec `COMPLIANCE_REJECTION` si `identity_profiles.kyc_status !== 'verified'`.
- **Gap explicitement assumé (TODO_DECISION, voir ADR-047)** : ce dépôt ne modélise qu'un statut KYC binaire (`identity_profiles.kyc_status: verified | unverified | ...`) — `KYC_STANDARD` et `KYC_ENHANCED` exigent donc aujourd'hui exactement la même chose (`verified`). Une distinction réelle entre les deux paliers (pièces différentes, seuils de vérification différents) demanderait un nouveau champ, hors du périmètre du Prompt 19 tel qu'énoncé.
- **`settings.kyc.threshold` (UI) non reconnecté** : le texte affiché reste « 200 000 FCFA » codé en dur plutôt que lu dynamiquement depuis `compliance_rules` — risque de dérive documenté, pas corrigé, pour éviter le scope creep (l'énoncé du Prompt 19 porte sur le moteur, pas sur cet écran).
- **Vérifié par 21 tests** (`match-rule.test.ts` — purs, sans DB ; `determine-requirement.test.ts` — intégration contre le vrai Supabase : absence de règle ⇒ `NONE`, seuil 200 000 XOF seedé, spécificité pays > devise, scénario `MANUAL_REVIEW`) et par la suite complète existante (`orchestrator.test.ts`, dont le test `COMPLIANCE_REJECTION` déjà en place, toujours au vert sans modification — la règle seedée reproduit exactement l'ancien seuil).
- **Non couvert à ce stade** : distinction réelle `KYC_STANDARD`/`KYC_ENHANCED` ; jeu de règles de conformité au-delà de l'unique règle seedée (pas de règles par pays, par fournisseur, etc. — à ajouter au fil de l'eau via la table, sans code) ; écran Back Office pour gérer `compliance_rules` (aucun des moteurs configurables — Fee/Limit/Compliance — n'a encore d'UI d'administration, Prompt 22+).

## 31. Notification Engine (Prompt 20)

`src/domains/notifications/` — remplace le STUB `notifyTransactionSettled` posé au Prompt 09. Architecture exactement conforme à l'énoncé : **Domain Event → Notification Event → Template → Channel Adapter**, sans construire par anticipation l'Event Bus générique (`TransactionCreated`, dead-letter, tracing…) explicitement réservé au Prompt 26 — ce moteur consomme des appels directs typés (`NotificationEvent`), pas un bus.

- **Deux Notification Event câblés** : `transaction_settled` et `transaction_failed`, les deux seuls points d'intégration déjà nommés dans le pipeline de l'orchestrateur (`orchestrator-steps/notification.ts`). Émis pour l'expéditeur systématiquement, et pour le destinataire aussi quand le règlement est un virement interne (`destination_type = naminto_wallet`). Les autres événements candidats (`money_request_created`, blocages Fraud/Compliance, nouvel appareil…) restent volontairement non câblés à ce stade — voir TODO_DECISION.
- **Trois canaux, honnêtement typés** (même distinction REAL/SANDBOX/MOCK/UNAVAILABLE que le Provider Gateway, Prompt 07) : **IN_APP** (REAL — la ligne `notifications` déjà écrite est la livraison, rien d'externe à appeler), **PUSH** (**UNAVAILABLE** assumé — aucun jeton d'appareil ni fournisseur FCM/APNs dans ce dépôt ; se présenter en MOCK aurait été une fausse intégration), **SMS** (**SANDBOX** — simulé et journalisé, jamais un vrai envoi, même principe que les adapters `providers/sandbox/*.ts`).
- **Templates FR/EN** (`templates.ts`) — une fonction par type d'événement plutôt qu'une table de correspondance ; réutilise pour `transaction_failed` les mêmes codes que `ORCHESTRATOR_ERROR_KEYS` (déjà utilisés côté client dans `send-money-wizard.tsx`/`money-requests/actions.ts`), reformulés en texte plutôt qu'en clé i18n puisque ce contenu est persisté tel quel.
- **Préférences par canal** (migration `0012_notifications.sql` : `identity_profiles.notify_in_app/notify_push/notify_sms`, tous `true` par défaut) — `notifications_enabled` (Prompt 04) reste l'interrupteur général : s'il est à `false`, aucun canal n'est utilisé quel que soit l'état des préférences par canal. Exposées dans `/settings` (nouvelle sous-section « Canaux de notification »).
- **Retries réels, sans file d'attente inventée** : jusqu'à 3 tentatives immédiates par canal, **sauf pour UNAVAILABLE** (retenter un canal structurellement absent ne changerait rien — seul REAL/SANDBOX/MOCK bénéficie du retry). `retryDelivery(deliveryId)` est en plus exposée pour relancer plus tard une livraison `FAILED` (ex. depuis un futur écran Back Office, Prompt 22) — aucun planificateur/queue n'existe dans ce dépôt, donc aucune reprise différée automatique.
- **Historique consultable** : `notifications` (RLS : lecture et marquage « lu » par le titulaire uniquement, écriture par service_role) alimente à la fois la nouvelle page `/notifications` et le dropdown cloche du shell (`shell/notifications-menu.tsx`) — un STUB scaffoldé dès le Prompt 03, toujours vide jusqu'ici, désormais branché sur les vraies données (badge non-lus compris) via `(user)/layout.tsx`. `notification_deliveries` (statut par canal, tentatives) reste une table interne, jamais exposée au client — même garantie que `security_events`.
- **Contrainte explicite du prompt — « une panne SMS ne doit jamais annuler une transaction financière déjà confirmée »** : appliquée à deux niveaux (défense en profondeur). `sendNotification` ne lève jamais (tout est capturé et journalisé en interne). `orchestrator.ts` encapsule quand même son appel à `notifyTransactionSettled` dans son propre `try/catch`, juste après la transition vers `settled` — corrige au passage un bug latent découvert en écrivant ce prompt : avant cette étape, une exception non interceptée à cet endroit précis remontait jusqu'à `runPaymentOrchestrator`, qui tentait alors une transition `settled → failed` (invalide, donc silencieusement ignorée par `safeTransition`) puis **relançait quand même l'erreur à l'appelant** — une transaction réellement réglée en base pouvait ainsi apparaître en échec côté Server Action. Le même correctif symétrique existe pour `notifyTransactionFailed` dans le bloc `catch` (une panne de notification ne doit jamais masquer l'erreur d'origine).
- **Dispatch en parallèle, pas en série** : les canaux d'une même notification (`Promise.all`) et les destinataires d'un même événement (expéditeur/destinataire) sont dispatchés indépendamment — évite de cumuler les latences réseau vers Supabase, nécessaire pour que `orchestrator.test.ts` (5 règlements réels dans un même test) reste sous un temps raisonnable.
- **Vérifié par 21 tests** (`templates.test.ts` — purs ; `send-notification.test.ts` — intégration contre le vrai Supabase : 3 canaux avec leurs modes réels, interrupteur général, préférence par canal, téléphone vérifié ⇒ SMS réussit, `retryDelivery` réussi et rejeté) et par la suite complète (167 tests, dont chaque transaction `settled`/`failed` de la suite existante déclenche désormais un vrai passage dans ce moteur plutôt que le STUB `console.info`). Vérifié manuellement dans le navigateur : préférences par canal affichées et persistées (`/settings`), page `/notifications` et dropdown cloche du shell tous deux fonctionnels (état vide correct pour un compte sans historique).
- **Non couvert à ce stade** (TODO_DECISION, voir tableau) : enregistrement de jetons push (PUSH restera UNAVAILABLE tant qu'aucun fournisseur FCM/APNs n'est connecté) ; fournisseur SMS réel (SANDBOX restera la seule option tant qu'aucune clé API n'est configurée) ; `money_request_created`, blocages Fraud/Compliance, nouvel appareil et autres `security_events` non câblés au Notification Engine — `security_events` reste leur seul journal pour l'instant ; le même bug de panne-après-confirmation existe potentiellement pour Reconciliation (Prompt 24, encore un STUB qui ne lève jamais aujourd'hui, donc sans conséquence pratique tant qu'il reste un STUB) ; écran Back Office `/admin/notifications` (scaffoldé, toujours `ComingSoonPage` — Prompt 22).

## 32. Prochaines étapes

Conformément au protocole, les prompts sont exécutés un par un avec validation entre chaque étape :

- **Prompt 21** — à confirmer avec l'utilisateur avant de commencer.
