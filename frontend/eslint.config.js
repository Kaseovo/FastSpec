// Flat ESLint config (ESLint 9+). Enforced in CI with --max-warnings=0.
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // The form editor passes one shared, mutable `formData` object down to
      // its tabs, which edit fields inside it (see PathsTab.vue). Reassigning
      // a prop itself is still an error.
      "vue/no-mutating-props": ["error", { shallowOnly: true }],
      "vue/multi-word-component-names": "off",
      // PrimeVue components are registered under their own names (Button,
      // Dialog, Menu, …), which this rule reports as clashing with HTML.
      "vue/no-reserved-component-names": "off",
    },
  },
  {
    // Tests run under Vitest with `globals: true` (describe, test, vi, …).
    files: ["**/*.spec.js", "**/*.test.js", "**/__tests__/**", "vitest.setup.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
  {
    files: ["*.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Must be last: turns off stylistic rules that conflict with Prettier.
  eslintConfigPrettier,
];
