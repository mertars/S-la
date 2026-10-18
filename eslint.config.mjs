// Uygulamanın lint ayarı (npm run lint).
import js from "@eslint/js";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default [
  { ignores: ["dist/**", ".kesem-test/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    plugins: { react, "react-hooks": hooks },
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    settings: { react: { version: "18.3" } },
    rules: { "react/jsx-uses-vars": "error", "react/jsx-uses-react": "off", "react/jsx-no-undef": "error", "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn", "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] },
  },
];
