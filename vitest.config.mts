import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// The existing suites (finance-math, notification-schedule, push-utils,
// middleware) deliberately import their subjects with relative paths so they
// can run with zero config. The multi-tenant-isolation suite tests the actual
// service layer in src/lib/services/, which imports internally via the "@/"
// alias (matching tsconfig's `paths`) — Vitest/Vite does not read tsconfig
// paths on its own, so this is the minimal config needed to resolve them.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
