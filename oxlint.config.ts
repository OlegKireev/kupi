import { defineConfig } from 'oxlint';

// `extends: ['recommended']` is not in the TS type but is applied by default.
export default defineConfig({
  plugins: ['typescript'],
  rules: {
    'no-async-endpoint-handlers': 'off',
  },
});
