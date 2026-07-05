import { API_BASE_URL } from '@/shared/config';

export class ApiError extends Error {
  public status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 400 из /link или /lists/join — введённый код неверный/просрочен, а не
 * какая-то другая ошибка. Общая проверка для обоих мест, где это различие
 * важно вызывающему коду. */
export function isInvalidCodeError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 400;
}

/** Общий catch-обработчик для redeemLinkCode/joinList: не invalid-code —
 * пробрасываем дальше, invalid-code — отдаём вызывающему коду колбэком. */
export function handleInvalidCodeError(
  err: unknown,
  onInvalidCode: () => void,
): void {
  if (!isInvalidCodeError(err)) {
    throw err;
  }
  onInvalidCode();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `${init?.method ?? 'GET'} ${path} -> ${res.status}`,
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    method: 'POST',
  });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    method: 'PATCH',
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
