# NAMINTO.EX — Architecture technique

Document produit par le **Prompt 01 — Reconnaissance et architecture** du protocole `Les 30 prompts de vibecoding ultra-directifs`. Il traduit la source de vérité fonctionnelle (`NAMINTO.EX ARCHITECTURE GENERALE.docx` et les spécifications de domaine `IDENTITY`, `USER`, `PAYMENTS`, `AUDIT`, `OBSERVABILITY`) en architecture technique concrète pour ce dépôt.

## 1. Résultat de l'audit initial (2026-08-25)

Le dépôt était vierge de code au moment de l'audit : uniquement des documents Word de spécification. Aucune architecture existante à préserver — ce document définit donc l'architecture cible dès l'origine, sans dette à gérer.

## 2. Stack technique retenue

| Élément | Choix | Statut |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript | Décidé (utilisateur, 2026-08-25) |
| Gestionnaire de paquets | npm | Décidé |
| Backend / données | Supabase (Postgres, Auth, Storage) | Décidé — projet déjà créé par l'utilisateur, identifiants à fournir avant le Prompt 04 (Identity) |
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
- Framework de test précis à choisir au Prompt 02 (TODO_DECISION, voir `/docs/DECISIONS.md`).

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

## 15. Prochaines étapes

Conformément au protocole, les prompts sont exécutés un par un avec validation entre chaque étape :

- **Prompt 04** — Identity (nécessite les identifiants Supabase).
