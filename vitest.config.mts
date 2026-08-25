import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
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
