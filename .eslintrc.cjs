module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  extends: ["eslint:recommended", "prettier"],
  ignorePatterns: ["dist", "node_modules"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended", "prettier"]
    }
  ]
};
