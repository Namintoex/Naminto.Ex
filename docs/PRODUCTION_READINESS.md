# NAMINTO.EX — Production Readiness Report

Produit par le **Prompt 30 — Final Production Gate** du protocole `Les 30 prompts de vibecoding ultra-directifs`. Revue complète menée simultanément comme CTO, Principal Architect, Security Engineer, QA Lead, Fintech Engineer et SRE, sur l'intégralité du dépôt construit aux Prompts 01-29.

**Aucune nouvelle fonctionnalité n'a été développée pour ce prompt**, conformément à sa consigne explicite. Un seul défaut réel a été corrigé (voir §7 — le code `TIMEOUT` de l'orchestrateur, déjà déclaré mais jamais atteignable). Tout le reste de ce document est un audit, pas une construction.

## 1. Verdict

> **NAMINTO.EX N'EST PAS "PRODUCTION READY".**

Trois conditions **critiques** sont en `FAIL` (détail §5, §6) :

1. **Aucun fournisseur `REAL`** n'est connecté (Orange/MTN/Moov/Wave/carte restent tous en mode `SANDBOX`) — aucun mouvement d'argent réel n'est possible aujourd'hui. Bloquant par construction, dépend d'identifiants et de contrats fournisseurs hors du périmètre technique (ADR-020/ADR-022, TODO_DECISION).
2. **`limit_rules` est vide** — aucun plafond réel (par transaction, journalier, mensuel, de fréquence) n'est configuré. « Absence de règle = absence de contrainte » est un choix assumé pour le développement (ADR-036), mais signifie qu'en l'état, un compte pourrait déplacer un montant illimité sans qu'aucune limite ne l'arrête.
3. **Aucune stratégie de sauvegarde/reprise après sinistre (Backup/DR)** n'a été définie ni implémentée à aucun des 29 prompts précédents — pas de politique de rétention, pas de RTO/RPO, pas de procédure documentée.

Tout le reste du système (moteur de paiement, comptabilité, sécurité, permissions, observabilité) est solide et vérifié empiriquement — voir le détail domaine par domaine ci-dessous. Ce n'est pas un verdict de qualité du code ; c'est un verdict sur l'aptitude à traiter de l'argent réel aujourd'hui.

## 2. Méthodologie

- Revue statique de l'intégralité de `src/` et `supabase/migrations/*.sql`, croisée avec les 57 ADR déjà consignés (`docs/DECISIONS.md`) et le tableau `TODO_DECISION` qui y est tenu à jour depuis le Prompt 01.
- Vérification empirique complète (§3) contre le vrai projet Supabase — jamais de mock.
- Vérification manuelle dans le navigateur (§8) : action admin non autorisée, revue responsive, flux Send Money bout en bout.
- Recherche systématique de code mort/déclaré-mais-jamais-atteint sur les points explicitement cités par le Master Prompt (§7).

## 3. Vérification empirique (compilation → build)

| Vérification | Résultat |
|---|---|
| 1. Compilation (`npm run build`, Turbopack) | **PASS** — 44 routes générées, aucune erreur |
| 2. Type checking (`npx tsc --noEmit`) | **PASS** — 0 erreur |
| 3. Unit tests | **PASS** — inclus dans la suite Vitest ci-dessous |
| 4. Integration tests | **PASS** — inclus dans la suite Vitest ci-dessous (contre le vrai Supabase) |
| 5. API tests | **PASS** — route webhook générique couverte par `webhooks/*.test.ts` (signature, anti-rejeu, duplication) |
| 6. E2E tests | **WARNING** — voir §9, aucun framework E2E automatisé (Playwright/Cypress) n'a jamais été installé ; chaque prompt a été vérifié manuellement dans le navigateur contre le vrai Supabase, jamais par une suite E2E rejouable |
| 7. Security audit | **PASS** — Prompt 28 (ADR-056), 13 constats réels corrigés, 1 documenté non corrigé (voir §5, Payments) |
| 8. Permission audit | **PASS** — voir §8, vérifié en direct : un compte réel sans rôle est bien redirigé vers `/admin/forbidden` |
| 9. Idempotency audit | **PASS** — `idempotencyKey` obligatoire de bout en bout, testé par appels concurrents réels (`Promise.all`), voir §6 |
| 10. Ledger consistency audit | **PASS** — immuabilité réelle (trigger, y compris `service_role`), lots équilibrés validés avant écriture, réclamation atomique anti-double-écriture (ADR-038/040/056) |
| 11. Webhook audit | **PASS** — signature HMAC vérifiée, fenêtre anti-rejeu 5 min, duplication détectée en no-op sûr (ADR-053) |
| 12. Responsive audit | **PASS** — voir §8, aucun débordement horizontal constaté (mobile 375px) sur `/history`, `/send`, `/admin/transactions` ; navigation mobile à onglets + panneau déjà vérifiée au Prompt 03 |
| 13. i18n audit | **PASS** — FR/EN sur l'intégralité de l'app via `LocaleProvider` (ADR-010/011), aucune chaîne codée en dur repérée dans les écrans vérifiés |
| 14. accessibility audit | **WARNING** — voir §9, primitives Radix accessibles par construction (focus, clavier, ARIA — ADR-008) et labels de formulaire explicites partout, mais aucun audit automatisé (axe-core ou équivalent) n'a jamais été exécuté |
| 15. observability audit | **PASS** — Prompt 27 (ADR-055), neuf mesures couvertes, traçabilité de transaction bout en bout |

**Suite Vitest complète** (après le correctif §7) : **304 tests, 55 fichiers, tous verts**, contre le vrai projet Supabase (aucun mock). `npx eslint .` : propre, aucun avertissement.

## 4. Flux complet vérifié

```
USER → SOURCE → DESTINATION → BENEFICIARY → AMOUNT → FEE → RISK → LIMITS
     → AUTHENTICATION → CONFIRMATION → ORCHESTRATOR → PROVIDER → LEDGER
     → NOTIFICATION → RECONCILIATION → RECEIPT → HISTORY
```

**PASS.** Vérifié deux fois : par la suite d'intégration (`orchestrator.test.ts`, chaque étape et chaque code d'erreur classifié — `VALIDATION_ERROR`/`AUTH_ERROR`/`RISK_REJECTION`/`COMPLIANCE_REJECTION`/`LIMIT_ERROR`/`PROVIDER_ERROR`/`TIMEOUT`/`SYSTEM_ERROR`/`FRAUD_BLOCKED`/`MANUAL_REVIEW_REQUIRED`), et par un envoi réel dans le navigateur pendant ce prompt (référence `NEX-EEBEED50`, 1000 XOF + 35 XOF de frais, écritures Ledger équilibrées, visible dans `/history`). RECONCILIATION s'exécute immédiatement dans le pipeline (pas de tâche planifiée, ADR-052) — cohérent avec le choix déjà documenté, pas un défaut de ce flux.

## 5. Revue par domaine

### Identity — PASS
Supabase Auth + PIN haché (bcrypt, verrouillage atomique 5/15min), verrouillage de connexion atomique par hash e-mail (Prompt 28), appareils par cookie opaque, `security_events` append-only en lecture seule pour le titulaire. **WARNING** : pas de vérification téléphone/SMS ni de biométrie/WebAuthn (ADR-014, assumé). **TODO_DECISION** : journalisation `security_events` par compte réel pour `login_failed` (actuellement par hash e-mail seul).

### User — PASS
Profil, préférences, statut KYC protégé par trigger (`protect_privileged_identity_columns`, non auto-attribuable). **TODO_DECISION** : aucun fournisseur KYC réel connecté (`kyc_status` reste `unverified` pour tout le monde) ; changement de téléphone/nom légal non implémenté (lecture seule assumée).

### Accounts — WARNING
Liaison de compte, déliaison en soft-delete, écran de consentement explicite, aucun solde inventé. **FAIL implicite (voir §1)** : tous les fournisseurs restent `SANDBOX`, aucune connexion `REAL` — attendu jusqu'à obtention d'identifiants API réels (hors périmètre technique).

### Payments — WARNING (contient le FAIL critique des limites)
Orchestrateur complet (Validation→Routing→Fee→Transaction→Auth→Risk→Compliance→Limits→Fraud→Provider→Ledger→Notification→Reconciliation), State Machine à 14 statuts mirée côté base par trigger, idempotence de bout en bout (double clic, retry, appels concurrents tous testés). Fee/Limit/Risk/Fraud/Compliance Engines réels et testés. `TIMEOUT` désormais réellement atteignable (§7). **FAIL** : `limit_rules` vide — aucun plafond réel configuré, bloquant avant toute mise en production (déjà documenté, TODO_DECISION historique, escaladé ici en FAIL du gate final). **WARNING** : race condition non structurellement corrigée sur le Limit Engine (ADR-056, contrainte d'architecture Supabase-js/pooling, mitigée par l'ordre du pipeline) ; `recordReversal`/`recordRefund` testés au niveau domaine mais sans écran/action opérationnelle réelle pour les déclencher (ADR-027, aucun litige/remboursement possible en pratique aujourd'hui) ; scan QR caméra non implémenté (saisie manuelle, le lien reste scannable par une app appareil photo standard).

### Providers — WARNING
Interface `ProviderAdapter` unique, cinq adapters `SANDBOX` bien testés, instrumentation automatique (Prompt 27), aucune fausse intégration `REAL`. **WARNING** : mode `UNAVAILABLE` déclaré dans le type mais jamais exercé par aucun adapter enregistré — l'edge case « provider unavailable » explicitement demandé par ce prompt n'a pas de test dédié (voir §6) ; `healthCheck()` existe par adapter mais n'est pas consulté par l'orchestrateur avant d'appeler `transfer`/`receive`.

### Finance (Ledger/Fees/Reconciliation) — PASS
Comptabilité en partie double append-only, immuabilité réelle (y compris `service_role`), lots validés avant écriture, réclamation atomique anti-course (Prompt 28). Fee Engine entièrement piloté par configuration. Reconciliation Engine (Prompt 24) : trois vues comparées par cinq vérifications indépendantes, jamais d'écriture Ledger de son propre chef. **WARNING** : réconciliation par lot manuel limitée aux 200 transactions terminales les plus récentes, aucun ordonnanceur/cron.

### Risk — PASS
Sept signaux indépendants testés isolément et bout en bout, blocage réel vérifié dans le navigateur (600 000 XOF bloqué avant même Compliance). **WARNING** : seuils en constantes de code, non configurables en base (acceptable — non explicitement exigé par le Prompt 17, à la différence du Fee/Limit Engine).

### Compliance — PASS
Moteur configurable en base (`compliance_rules`), seuil KYC testé. **TODO_DECISION** : une seule règle réelle seedée (200 000 XOF) ; `KYC_STANDARD`/`KYC_ENHANCED` appliquent aujourd'hui la même exigence (distinction non implémentée, ADR-047).

### Support — PASS
Naminto Assist (moteur d'intentions déterministe, jamais un LLM — conforme à « Assistant IA ≠ opérateur financier »), tickets créés et consultables au Back Office. **TODO_DECISION** : FAQ administrable (Prompt 22) non encore consommée par Assist ; aucune notification au titulaire quand un ticket change de statut.

### Notifications — PASS
Event Bus découplé (Prompt 26) avec idempotence à deux couches, retry/backoff/dead-letter réels, deux événements réels câblés (`transaction_settled`/`transaction_failed`). **WARNING** : PUSH reste `UNAVAILABLE` (aucun FCM/APNs), SMS reste `SANDBOX` (aucune clé fournisseur réelle) — correctement étiquetés, pas des bugs ; couverture événementielle limitée (`money_request_created`, blocages Fraud/Compliance non notifiés).

### Administration (Back Office/RBAC/Audit) — PASS
RBAC avec bootstrap atomique (Prompt 28), permissions vérifiées côté serveur sur chaque page et chaque Server Action — **revérifié en direct pendant ce prompt** : un compte réel sans rôle est bien redirigé vers `/admin/forbidden`, jamais un simple masquage UI (§8). Douze modules Back Office construits et testés. **WARNING** : `/admin/incidents` reste un stub (`ComingSoonPage`, dépend de l'Availability Engine, hors périmètre des 30 prompts) ; aucune state machine réelle sur les transitions KYC admin (tout changement est accepté).

### Infrastructure (API/Events/Monitoring/Security/Backup/DR) — FAIL (Backup/DR)
Observability (Prompt 27) : neuf mesures, request/provider logging, traçabilité de transaction bout en bout. Event Bus idempotent avec retry. Security Audit (Prompt 28) : 13 constats réels corrigés. `TIMEOUT` désormais implémenté (§7). **FAIL** : aucune stratégie de sauvegarde/reprise après sinistre définie à aucun moment des 29 prompts précédents — pas de fréquence de sauvegarde, pas de RTO/RPO, pas de procédure de restauration documentée ou testée. **WARNING** : aucune plateforme d'observabilité externe connectée (Grafana/Datadog — mesures internes à Postgres uniquement, TODO_DECISION déjà documenté) ; aucun framework E2E ni outil d'audit d'accessibilité automatisé (§9).

## 6. Scénarios explicitement testés (Master Prompt)

| Scénario | Statut | Preuve |
|---|---|---|
| Double clic | **PASS** | `idempotencyKey` généré une seule fois côté client et conservé ; bouton de confirmation désactivé pendant la soumission (`loading`/`disabled`) — protection UI **et** protection serveur (rejeu = même transaction, jamais un doublon) |
| Refresh | **PASS** | Aucun état partiel persisté avant l'appel serveur ; un refresh en cours de saisie repart d'un formulaire vide (comportement attendu, pas un bug) ; une transaction déjà lancée continue côté serveur indépendamment du client |
| Retry | **PASS** | Même mécanisme que double clic — `createTransaction` idempotent, `isInFlight` empêche de rejouer un effet de bord (PIN, appel fournisseur) déjà exécuté |
| Timeout | **PASS (corrigé ce prompt, §7)** | `TIMEOUT` était déclaré mais jamais atteignable avant ce prompt — désormais un appel fournisseur sans réponse après 30s produit réellement `OrchestratorError("TIMEOUT")`, testé (`execute-provider.test.ts`, 4 tests) |
| Duplicate webhook | **PASS** | `process-webhook.test.ts` : un même `event_id` rejoué devient `duplicate`, jamais retraité |
| Provider failure | **PASS** | `orchestrator.test.ts` : solde SANDBOX insuffisant → `PROVIDER_ERROR`, transaction `failed` |
| Provider unavailable | **WARNING** | Aucun adapter enregistré n'est jamais en mode `UNAVAILABLE` ; aucun test ne simule une panne fournisseur totale (distinct d'un simple refus métier) — gap réel, voir Providers §5 |
| Payment rejection | **PASS** | `RISK_REJECTION`/`COMPLIANCE_REJECTION`/`LIMIT_ERROR`/`FRAUD_BLOCKED`/`MANUAL_REVIEW_REQUIRED` tous testés bout en bout |
| Reversal | **PASS (niveau domaine)** | `record-entries.test.ts` : écritures miroir correctes, idempotent, échoue sans règlement préalable — **mais aucun déclencheur produit réel** (§5, Payments) |
| Refund | **PASS (niveau domaine)** | Même couverture que reversal, même limite d'absence de déclencheur produit |
| Concurrent requests | **PASS** | Couverture large depuis l'audit du Prompt 28 : réclamation Ledger, réclamation demande d'argent, verrouillage PIN, verrouillage connexion, bootstrap RBAC — tous vérifiés par de vrais appels `Promise.all` concurrents, pas simulés séquentiellement |
| Unauthorized admin action | **PASS (revérifié en direct ce prompt)** | Compte réel `demo.naminto.ex.recipient@example.test` (aucun rôle admin) redirigé vers `/admin/forbidden` (« Accès refusé ») en tentant `/admin/countries` — contrôle serveur, jamais un masquage UI |

## 7. Correctif appliqué pendant ce prompt

**`TIMEOUT` de l'orchestrateur, déclaré mais jamais réellement atteignable.** `OrchestratorErrorCode` incluait `TIMEOUT` depuis le Prompt 09, et `failureStatusFor`/le mapping vers `expired` existaient déjà dans `orchestrator.ts` — mais aucun code n'appelait jamais `new OrchestratorError("TIMEOUT", ...)` : un appel fournisseur qui ne répondrait jamais aurait laissé l'utilisateur indéfiniment en attente au lieu d'échouer proprement. Repéré en vérifiant explicitement le scénario « timeout » exigé par ce prompt.

- **Correctif** (`src/domains/payments/orchestrator-steps/execute-provider.ts`) : `withTimeout()`, une course entre l'appel fournisseur et un délai (`PROVIDER_CALL_TIMEOUT_MS = 30_000`, choix raisonnable non documenté dans les sources, même statut que les seuils du Risk Engine — ADR-045). `executeProviderTransfer` accepte désormais un `timeoutMs` (paramètre, défaut 30s) pour rester testable sans attendre un vrai délai de 30 secondes.
- **Test** (`execute-provider.test.ts`, 4 tests, nouveau) : `withTimeout` en isolation (résolution normale, timeout réel, propagation d'erreur d'origine) + un fournisseur fictif qui ne répond jamais (registre mocké) prouvant que `executeProviderTransfer` se termine bien en `TIMEOUT` plutôt qu'en attente indéfinie.
- **Aucune régression** : suite complète repassée après le correctif (304 tests, 55 fichiers, tous verts), `tsc`/`eslint`/`build` propres.

## 8. Vérification manuelle (navigateur, contre le vrai Supabase)

- **Action admin non autorisée** : connexion avec un compte réel sans rôle admin (`demo.naminto.ex.recipient@example.test`), tentative d'accès direct à `/admin/countries` → redirection immédiate vers `/admin/forbidden` (« Votre compte n'a pas la permission d'accéder à cette page »). Confirme que la garde est côté serveur (`requirePermission`), jamais un simple lien masqué.
- **Responsive** : `/history`, `/send`, `/admin/transactions` vérifiés à 375px (mobile) — aucun débordement horizontal (`document.documentElement.scrollWidth === window.innerWidth` sur les trois), navigation mobile à onglets + bouton « Plus » fonctionnelle.
- **Flux complet réel** : envoi de 1000 XOF entre deux comptes réels (`naminto_wallet → naminto_wallet`), statut `settled`, référence `NEX-EEBEED50`, visible dans `/history`.

## 9. Limites de cette revue, honnêtement déclarées

- **Aucun framework E2E automatisé** (Playwright/Cypress/etc.) n'existe dans ce dépôt. Chaque prompt, y compris celui-ci, s'est appuyé sur une vérification manuelle dans le navigateur contre le vrai Supabase — réelle, mais non rejouable automatiquement en CI. Installer un tel framework serait une nouvelle capacité d'infrastructure de test, hors du périmètre « ne développe plus de nouvelles fonctionnalités » de ce prompt — signalé ici comme un TODO_DECISION pour un futur prompt.
- **Aucun outil d'audit d'accessibilité automatisé** (axe-core ou équivalent) n'a jamais tourné. Les fondations sont bonnes (Radix UI, labels explicites, ADR-008) mais non vérifiées systématiquement (contraste, ordre de tabulation complet, lecteurs d'écran réels).
- Cette revue s'appuie fortement sur les 57 ADR déjà consignés dans `docs/DECISIONS.md` plutôt que de re-dériver chaque décision depuis zéro — cohérent avec le principe déjà établi de ce dépôt (une décision une fois prise et documentée n'est pas rejugée sans raison nouvelle).

## 10. Ce qui bloque réellement une mise en production avec de l'argent réel

Dans l'ordre où ils devraient être levés :

1. **Configurer `limit_rules`** avec de vraies valeurs métier (par transaction, journalier, mensuel, fréquence) — aujourd'hui aucune limite n'existe.
2. **Décider et documenter une stratégie Backup/DR** (fréquence, rétention, RTO/RPO, procédure de restauration testée) — jamais abordé.
3. **Connecter au moins un fournisseur en mode `REAL`** (identifiants API, contrats — dépendance business, hors périmètre technique).
4. Fermer la race condition du Limit Engine par une fonction Postgres unique verrouillée par utilisateur (actuellement mitigée, pas éliminée — ADR-056).
5. Construire les écrans opérationnels manquants pour agir sur ce qui est déjà détecté : revue manuelle (`MANUAL_REVIEW_REQUIRED`), litiges/remboursements (`disputed`, reversal/refund).

Le tableau `TODO_DECISION` complet, avec tous les points non bloquants, reste tenu à jour dans `docs/DECISIONS.md`.
