import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@conversational/domain": resolve(__dirname, "../domain/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.spec.ts"],
    globals: true,
    environment: "node",
  }
});
