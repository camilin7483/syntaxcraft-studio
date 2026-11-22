import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.test-runtime/**', '**/.vscode-test/**', '**/release/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{mjs,cjs,js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/control-center/src/web/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
);
