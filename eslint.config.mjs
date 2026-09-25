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
        indexedDB: 'readonly',
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
        // CDN script globals (index.html <script> tags)
        Papa: 'readonly',
        // Node (for scripts/ + server-side guards)
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-useless-escape': 'off',
      // DOM-sink tripwire: an interpolated template assigned to innerHTML (or
      // passed to insertAdjacentHTML) is how imported data becomes markup.
      // Escape it with escapeHtml() (src/utils/dom.js) or build nodes with
      // textContent. An already-escaped template suppresses this rule with a
      // one-line lint directive that states the reason — see
      // src/views/similarityModal.js for the working pattern.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "AssignmentExpression[left.property.name='innerHTML'] > TemplateLiteral[expressions.0]",
          message:
            'Escape imported data with escapeHtml() (src/utils/dom.js) before assigning to innerHTML, or build nodes with textContent. Extracted markup builders in src/components/** are the preferred shape.',
        },
        {
          selector:
            "CallExpression[callee.property.name='insertAdjacentHTML'] > TemplateLiteral[expressions.0]",
          message:
            'insertAdjacentHTML with interpolated data: escape with escapeHtml() or build nodes with textContent.',
        },
      ],
    },
  },
  prettier,
];
