import { defineConfig } from 'oxlint';

import baseConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [baseConfig],
  plugins: ['import', 'react', 'react-perf', 'jsx-a11y'],
});
