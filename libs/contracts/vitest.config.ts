import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@conversational/domain": resolve(__dirname, "../domain/src/index.ts"),
      "@conversational/contracts": resolve(__dirname, "src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.spec.ts"],
  },
});
