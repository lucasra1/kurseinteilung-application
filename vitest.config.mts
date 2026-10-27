import { defineConfig } from "vitest/config";

// Unit tests for pure modules only (`lib/*.test.ts`): no DB, no `server-only` imports.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
