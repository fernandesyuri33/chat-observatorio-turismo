import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["libs/llm/src/**/*.spec.ts"],
    globals: true,
    environment: "node"
  }
});
