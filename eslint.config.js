import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'data'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The ToolDef handler contract and WebSocket glue use intentional `any` (mirrors the harness).
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow deliberately-unused args/vars when prefixed with `_`.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // TypeScript already resolves identifiers; core no-undef is redundant here and would flag
      // browser/node globals it doesn't track.
      'no-undef': 'off',
    },
  },
  // Keep ESLint out of formatting — Prettier owns that.
  prettier,
);
