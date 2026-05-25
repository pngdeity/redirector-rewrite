import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        matchMedia: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        decodeURIComponent: 'readonly',
        encodeURIComponent: 'readonly',
        atob: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        HTMLElement: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        Node: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'test-results/',
      'playwright-report/',
    ],
  },
];
