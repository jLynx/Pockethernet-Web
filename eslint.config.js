import js from '@eslint/js';
import css from '@eslint/css';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const maxCssLinesRule = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: { tooMany: 'File has {{actual}} lines. Maximum allowed is 500.' },
  },
  create(context) {
    return {
      StyleSheet(node) {
        const actual = context.sourceCode.lines.length;
        if (actual > 500) context.report({ node, messageId: 'tooMany', data: { actual } });
      },
    };
  },
};

const projectPlugin = { rules: { 'max-css-lines': maxCssLinesRule } };

export default tseslint.config(
  {
    ignores: ['dist', 'storybook-static', 'node_modules', '.wrangler'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: false, skipComments: false }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
    ...reactRefresh.configs.vite,
  },
  {
    files: ['src/**/*.test.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    ...css.configs.recommended,
    files: ['src/**/*.css'],
    plugins: { ...css.configs.recommended.plugins, project: projectPlugin },
    language: 'css/css',
    rules: {
      ...css.configs.recommended.rules,
      'project/max-css-lines': 'error',
    },
  },
);
