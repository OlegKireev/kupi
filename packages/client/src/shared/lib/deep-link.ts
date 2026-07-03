export type DeepLink = { kind: 'list' | 'device'; code: string };

/** Разбирает `window.location.search` на код инвайта/линковки. */
export function parseDeepLink(search: string): DeepLink | null {
  const params = new URLSearchParams(search);
  const listCode = params.get('listCode');
  if (listCode) {
    return { kind: 'list', code: listCode };
  }
  const deviceCode = params.get('deviceCode');
  if (deviceCode) {
    return { kind: 'device', code: deviceCode };
  }
  return null;
}

/** Собирает диплинк-URL из текущего origin для QR/кнопки «Поделиться». */
export function buildDeepLink(kind: 'list' | 'device', code: string): string {
  const param = kind === 'list' ? 'listCode' : 'deviceCode';
  return `${window.location.origin}/?${param}=${code}`;
}
