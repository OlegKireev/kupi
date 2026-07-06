import { useRef, useState } from 'react';

/** Оборачивает async-действие: гвардит повторный запуск, пока предыдущий не
 * завершился (защита от двойного сабмита — иначе даблклик по «Создать»
 * заводит два списка), и отдаёт `loading` для кнопки. Ошибки не глотает —
 * они всплывают в глобальный unhandledrejection-хендлер (см. main.tsx). */
export function useAsyncAction(action: () => Promise<void>) {
  const [isLoading, setIsLoading] = useState(false);
  const isRunning = useRef(false);

  const run = async (): Promise<void> => {
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;
    setIsLoading(true);
    try {
      await action();
    } finally {
      isRunning.current = false;
      setIsLoading(false);
    }
  };

  return { isLoading, run };
}
