import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig({
  files: ['./src/**/*.{js,mjs,cjs,ts,mts,cts}'],
  ignores: ['dist/**', 'node_modules/**'],
  extends: [
    js.configs.recommended,
    tseslint.configs.strict,
    eslintConfigPrettier,
  ],
  languageOptions: {
    parserOptions: {
      project: './tsconfig.json',
    },
    globals: globals.node,
  },
  rules: {
    'no-console': 'warn',
  },
});
