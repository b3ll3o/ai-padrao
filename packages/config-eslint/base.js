import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      // INC-019 (proposal: complexity-gate). Cyclomatic complexity threshold
      // matches SonarSource's default. `pnpm harness:check` (INC-019) and
      // `.githooks/pre-push` enforce the same rule at the repo level; this
      // declaration makes `pnpm lint` (turbo) fail per-workspace too.
      complexity: ["error", { max: 10 }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettier,
];
