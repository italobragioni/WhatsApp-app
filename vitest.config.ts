import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Satisfy env validation (src/lib/env.ts) during tests. No real DB/AI used.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/vendeia_test",
      AUTH_SECRET: "test-secret-0123456789abcdef",
      WHATSAPP_VERIFY_TOKEN: "verify-token-test",
      WHATSAPP_APP_SECRET: "app-secret-test",
      LOGZZ_WEBHOOK_SECRET: "logzz-secret-test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
