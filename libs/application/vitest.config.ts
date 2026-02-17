import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@conversational/domain": resolve(__dirname, "../domain/src/index.ts"),
      "@conversational/application": resolve(__dirname, "src/index.ts"),
      "@conversational/policy": resolve(__dirname, "../policy/src/index.ts"),
      "@conversational/llm": resolve(__dirname, "../llm/src/index.ts"),
      "@conversational/providers": resolve(__dirname, "../providers/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["libs/application/tests/**/*.spec.ts"],
  },
});
