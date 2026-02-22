import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@conversational/domain": resolve(__dirname, "../../libs/domain/src/index.ts"),
      "@conversational/contracts": resolve(__dirname, "../../libs/contracts/src/index.ts"),
      "@conversational/application": resolve(__dirname, "../../libs/application/src/index.ts"),
      "@conversational/policy": resolve(__dirname, "../../libs/policy/src/index.ts"),
      "@conversational/llm": resolve(__dirname, "../../libs/llm/src/index.ts"),
      "@conversational/providers": resolve(__dirname, "../../libs/providers/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
