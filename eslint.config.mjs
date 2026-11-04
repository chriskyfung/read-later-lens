/** @type {import('eslint').Linter.Config[]} */
import viteConfig from './vite.config.js';
import js from '@eslint/js';
import importplugin from 'eslint-plugin-import';
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
        // Node (for scripts/ + server-side guards)
        globalThis: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      import: importplugin,
    },
    settings: {
      // Resolve Vite aliases (`src/` and `@/`) directly from vite.config.js
      // via eslint-import-resolver-vite, so eslint-plugin-import can lint
      // `import ... from 'src/...'` and `import ... from '@/...'` without
      // unresolved-module warnings. Single source of truth: vite.config.js
      // resolve.alias; jsconfig.json mirrors it for VS Code IntelliSense.
      'import/resolver': {
        vite: {
          viteConfig,
        },
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
      // Never-reassigned bindings must be const: the analytics word loop
      // shipped `let` for years because neither the recommended set nor this
      // file flagged it.
      'prefer-const': 'error',
      // DOM-sink tripwire: an interpolated template assigned to innerHTML (or
      // passed to insertAdjacentHTML) is how imported data becomes markup.
      // Escape it with escapeHtml() (src/utils/dom/) or build nodes with
      // textContent. An already-escaped template suppresses this rule with a
      // one-line lint directive that states the reason — see
      // src/views/similarityModal.js for the working pattern.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "AssignmentExpression[left.property.name='innerHTML'] > TemplateLiteral[expressions.0]",
          message:
            'Escape imported data with escapeHtml() (src/utils/dom/) before assigning to innerHTML, or build nodes with textContent. Extracted markup builders in src/components/** are the preferred shape.',
        },
        {
          selector:
            "CallExpression[callee.property.name='insertAdjacentHTML'] > TemplateLiteral[expressions.0]",
          message:
            'insertAdjacentHTML with interpolated data: escape with escapeHtml() or build nodes with textContent.',
        },
      ],
      // === Import path checking rules (eslint-plugin-import) ===
      // Resolver alias mapping for `src/` is confirmed working (see
      // tests/paths-alias.test.js), so unresolved imports are now errors.
      // Node built-ins (imported with the `node:` prefix in tests) always
      // resolve in Node and are intentionally ignored here.
      // `?url` suffixes are a Vite build-time feature (wasm URL for sql.js);
      // the file exists on disk and is resolved by Vite, not by ESLint.
      'import/no-unresolved': ['error', { ignore: ['^node:', '\\?url$'] }],
      // Blocks absolute-path imports (e.g. /foo/bar) — no resolver needed.
      'import/no-absolute-path': 'error',
      // Fails when the same module is imported more than once.
      'import/no-duplicates': 'warn',
      // Fails when circular imports are detected.
      'import/no-cycle': 'warn',
    },
  },
  prettier,
];
