// Flat ESLint config (ESLint 9+). Minimal ruleset — the goal is catching the
// classes of issue noted in docs/CODE_REVIEW.md (unused vars, obvious bugs)
// without forcing a large reformatting pass on 19k lines of existing Vue.
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Large pre-existing components (FormEditor.vue, DiffDrawer.vue — see
      // docs/CODE_REVIEW.md §13) intentionally aren't forced into a single
      // strict rule set here; that's a decomposition project, not a lint fix.
      "vue/multi-word-component-names": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  // Must be last: turns off stylistic rules that conflict with Prettier.
  eslintConfigPrettier,
];
