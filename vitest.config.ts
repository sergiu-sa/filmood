import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Deliberately NOT UTC. CI and Vercel both run UTC, which is exactly where
    // a timezone bug hides: lib/formatDate.ts's guard passes under UTC even
    // with the bug reintroduced. Pinning an offset zone makes the suite fail
    // where real viewers would. Fixed (not the machine's zone) so runs are
    // reproducible across machines.
    env: { TZ: "America/New_York" },
    // Default node; opt into jsdom per-file via /** @vitest-environment jsdom */.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Excludes tests/e2e/ (Playwright specs use a different runner).
    include: [
      "lib/__tests__/**/*.test.{ts,tsx}",
      "app/__tests__/**/*.test.{ts,tsx}",
      "components/__tests__/**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
