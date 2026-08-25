import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    // Les tests d'intégration enchaînent plusieurs allers-retours réseau
    // vers le vrai projet Supabase (transitions de State Machine, appels
    // du Provider Gateway) — le délai par défaut de 5s est trop court.
    testTimeout: 30_000,
    // Plusieurs suites d'intégration écrivent une configuration GLOBALE
    // (fee_rules, limit_rules — non scopée par utilisateur) dans le même
    // projet Supabase partagé. Exécuter les fichiers de test en parallèle
    // permettrait à la règle temporaire d'un fichier de fausser le
    // résultat d'un autre fichier tournant au même instant (vécu
    // concrètement : une règle frequency_count posée par
    // limit-engine/check-limits.test.ts a fait échouer un test
    // d'orchestrator.test.ts exécuté en parallèle). Les fichiers tournent
    // donc en série ; chaque fichier nettoie déjà sa propre config après
    // chaque test (afterEach).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // "server-only" lève toujours une erreur hors du build Next.js par
      // conception (voir test/stubs/server-only.ts) — Next le substitue
      // lui-même par un no-op dans ses bundles serveur ; on fait pareil ici.
      "server-only": path.resolve(import.meta.dirname, "./test/stubs/server-only.ts"),
    },
  },
});
