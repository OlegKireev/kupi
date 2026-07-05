import { useEffect, useRef, useState } from 'react';

import { parseDeepLink, type DeepLink } from '@/shared/lib/deep-link';

/** Диплинк (?listCode=.../?deviceCode=...) читается один раз при старте —
 * useRef-guard против двойного вызова в React StrictMode. URL сбрасывается
 * целиком (других query-параметров у приложения сейчас нет), чтобы
 * обновление страницы не открывало модалку повторно. */
export function useDeepLink() {
  const [deepLink, setDeepLink] = useState<DeepLink | null>(null);
  const parsed = useRef(false);

  useEffect(() => {
    if (parsed.current) {
      return;
    }
    parsed.current = true;
    const result = parseDeepLink(window.location.search);
    if (result) {
      setDeepLink(result);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return { clearDeepLink: () => setDeepLink(null), deepLink };
}
