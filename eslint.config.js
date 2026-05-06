import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Item-13: src/ (browser bundle) must not import api/ (server-only).
  // The api/_lib/* modules wire the Supabase service-role key — leaking
  // them into the client bundle would expose RLS-bypass credentials.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/api/**", "../api/**", "../../api/**", "../../../api/**"],
              message:
                "src/ code must not import server-only api/ modules — they wire the Supabase service-role key and only run in the Vercel Node runtime. Move shared logic to src/lib/ or duplicate the type. (Item-13)",
            },
          ],
        },
      ],
    },
  },
);
