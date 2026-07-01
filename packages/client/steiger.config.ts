import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  // ponytail: первый вертикальный срез — фичи/виджет неизбежно используются
  // по одному разу; правило имеет смысл включить обратно, когда появится
  // второй экран/сценарий
  {
    rules: {
      'fsd/insignificant-slice': 'off',
      // *-item — самые точные имена для этих фич в предметной области списка
      // покупок; правило видит только повтор слова, не оценивает ясность
      'fsd/repetitive-naming': 'off',
    },
  },
]);
