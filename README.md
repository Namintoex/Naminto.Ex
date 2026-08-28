# NAMINTO.EX

Plateforme d'orchestration et de gestion des paiements multi-réseaux. Dépôt distinct de Naminto Académie — git et Supabase propres à ce projet.

## Documents source de vérité

- `NAMINTO.EX ARCHITECTURE GENERALE.docx` — vision produit et architecture fonctionnelle (référence absolue).
- `Les 30 prompts de vibecoding ultra-directifs.docx` — protocole de développement (un prompt à la fois, avec validation entre chaque étape).
- `IDENTITY`, `USER`, `PAYMENTS`, `AUDIT`, `OBSERVABILITY — Spécification Markdown.docx` — spécifications de domaine détaillées.
- [`/docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture technique de ce dépôt.
- [`/docs/DECISIONS.md`](docs/DECISIONS.md) — journal des décisions et `TODO_DECISION` en attente.

## Stack

Next.js 16 (App Router) + TypeScript strict, npm, Supabase (backend/données).

## Développement

```bash
npm install
cp .env.example .env.local   # renseigner les identifiants Supabase du projet Naminto.Ex
npm run dev -- -p 3010
```

Ouvrir [http://localhost:3010](http://localhost:3010). Port 3010 systématiquement, jamais 3000 — réservé à Naminto Académie, un projet totalement distinct (dépôt et Supabase séparés).

## Tests

```bash
npm run test
```

⚠️ Les tests d'intégration (`*.test.ts` sous `src/domains/`) tournent contre le vrai projet Supabase défini dans `.env.local` — ils créent et suppriment leurs propres données de test, mais nécessitent des identifiants valides.
