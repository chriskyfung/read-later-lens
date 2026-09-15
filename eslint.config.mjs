/** @type {import('eslint').Linter.Config[]} */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';

export default [
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '*.min.js', 'pnpm-lock.yaml'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Browser / UI
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Uint8Array: 'readonly',
        ArrayBuffer: 'readonly',
        FileList: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        NodeList: 'readonly',
        DOMParser: 'readonly',
        FileSystemFileHandle: 'readonly',
        // Node (for scripts/ + server-side guards)
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-useless-escape': 'off',
    },
  },
  prettier,
];
