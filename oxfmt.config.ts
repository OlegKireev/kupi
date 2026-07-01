import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  proseWrap: 'preserve',
  htmlWhitespaceSensitivity: 'css',
  endOfLine: 'lf',
  singleAttributePerLine: true,
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    'coverage',
    'pnpm-lock.yaml',
    '.claude',
  ],
  sortImports: {
    type: 'natural',
    order: 'asc',
    newlinesBetween: false,
    groups: [
      ['builtin', 'external'], // 1. Библиотеки из node_modules
      { newlinesBetween: true },
      'workspaces', // 2. Модули из соседних workspaces
      { newlinesBetween: true },
      'absolute', // 3. Абсолютные импорты (@/*)
      [
        'parent', // 4. Относительные импорты выше (../)
        'sibling', // 5. Модули из той же директории (./)
        'index',
      ],
      { newlinesBetween: true },
      ['style'], // 6. Стили (import styles from './style.css' и import './style.css')
      { newlinesBetween: true },
      'unknown', // 7. Все остальное
    ],
    customGroups: [
      {
        groupName: 'workspaces',
        elementNamePattern: ['@packages/**', '@kupi/**'],
      },
      {
        groupName: 'absolute',
        elementNamePattern: ['@/**'],
      },
    ],
  },
});
