import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'reports', '.stryker-tmp', 'tools/**/.venv'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Dense numerical kernels index arrays inside loops whose bounds are proven by construction;
    // with `noUncheckedIndexedAccess` the `!` assertion is the honest, zero-cost choice there.
    files: ['src/economics/core/**/*.ts', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // The scientific layer must stay framework- and DOM-free and avoid `any`.
    files: ['src/economics/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-dom',
            'react/*',
            'plotly*',
            'zustand*',
            '**/components/**',
            '**/pages/**',
          ],
        },
      ],
    },
    languageOptions: { globals: { ...globals.es2021 } },
  },
);
