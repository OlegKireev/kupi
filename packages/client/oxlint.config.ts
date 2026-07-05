import { defineConfig } from 'oxlint';

import baseConfig from '../../oxlint.config.ts';

export default defineConfig({
  categories: {
    correctness: 'error',
    nursery: 'off',
    pedantic: 'warn',
    perf: 'warn',
    restriction: 'error',
    style: 'warn',
    suspicious: 'warn',
  },
  extends: [baseConfig],
  overrides: [
    {
      files: ['*.test.ts'],
      rules: {
        'no-magic-numbers': 'off',
      },
    },
    {
      files: ['src/app/main.tsx'],
      rules: {
        'vitest/require-hook': 'off',
      },
    },
  ],
  plugins: ['react', 'react-perf', 'jsx-a11y', 'vitest'],
  rules: {
    'capitalized-comments': 'off',
    'func-style': [
      'error',
      'declaration',
      { allowArrowFunctions: true, allowTypeAnnotation: true, overrides: {} },
    ],
    'id-length': [
      'error',
      { exceptions: ['i', 'e', 'a', 'b', 'ctx', 'req', 'res', 'T', 'U'] },
    ],
    'max-lines-per-function': [
      'error',
      { max: 150, skipBlankLines: true, skipComments: true },
    ],
    'no-magic-numbers': [
      'error',
      {
        ignore: [-1, 0, 1, 200, 204, 400, 401, 404],
        ignoreArrayIndexes: true,
        ignoreEnums: true,
        ignoreNumericLiteral: true,
      },
    ],
    'no-ternary': 'off',
    'no-undefined': 'off',
    'react-perf/jsx-no-jsx-as-prop': 'off',
    'react-perf/jsx-no-new-function-as-prop': 'off',
    'react-perf/jsx-no-new-object-as-prop': 'off',
    'react/forbid-component-props': 'off',
    'react/jsx-filename-extension': ['error', { extensions: ['jsx', 'tsx'] }],
    'react/jsx-max-depth': ['error', { max: 4 }],
    'react/jsx-no-literals': 'off',
    'react/react-in-jsx-scope': 'off',
    'sort-imports': ['off', { ignoreCase: true }],
    'sort-keys': 'warn',
    'typescript/explicit-function-return-type': 'off',
    'typescript/explicit-module-boundary-types': 'off',
    'typescript/no-invalid-void-type': 'off',
    'vitest/no-hooks': 'off',
    'vitest/no-importing-vitest-globals': 'off',
    'vitest/prefer-expect-assertions': [
      'error',
      { onlyFunctionsWithAsyncKeyword: true },
    ],
    'vitest/require-test-timeout': 'off',
  },
});
