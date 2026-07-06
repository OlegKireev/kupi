import { useCallback, useEffect, useRef, useState } from 'react';

import type { Bootstrap, Category, List } from '@kupi/shared';

import { getCategories } from '@/entities/category';
import { clearListCache } from '@/entities/item';
import { createAccount, createList, getLists } from '@/entities/list';
import { ApiError } from '@/shared/api';
import { loadBootstrapCache, saveBootstrapCache } from './bootstrap-cache';

interface BootstrapResult {
  lists: List[];
  categories: Category[];
}

// Оффлайн-фолбэк для самого первого запроса при холодном старте: сеть
// недоступна (не ApiError) — берём последний сохранённый bootstrap.
// Известный пробел: если кеша тоже нет (самый первый запуск офлайн),
// экран остаётся пустым — см. client-known-issues.md.
function loadCachedBootstrapOrThrow(err: unknown): BootstrapResult {
  const cached = err instanceof ApiError ? null : loadBootstrapCache();
  if (!cached) {
    throw err;
  }
  return cached;
}

async function loadInitialBootstrap(): Promise<BootstrapResult> {
  try {
    const [lists, categories] = await Promise.all([
      getLists(),
      getCategories(),
    ]);
    return { categories, lists };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const bootstrap = await createAccount();
      return { categories: bootstrap.categories, lists: bootstrap.lists };
    }
    return loadCachedBootstrapOrThrow(err);
  }
}

export type BootstrapStatus = 'loading' | 'ready' | 'error';

// Загрузка bootstrap с явными loading/error-состояниями: до этого при сбое
// (500, офлайн без кеша) экран навсегда оставался пустым и неотличимым от
// загрузки. retry вызывает ту же функцию заново. Вынесено в под-хук, чтобы
// useAppLists укладывался в max-statements (тот же паттерн, что useDeepLink).
function useBootstrap(apply: (result: BootstrapResult) => void) {
  const [status, setStatus] = useState<BootstrapStatus>('loading');
  const isBootstrapped = useRef(false);

  const runBootstrap = useCallback(async (): Promise<void> => {
    setStatus('loading');
    try {
      apply(await loadInitialBootstrap());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [apply]);

  useEffect(() => {
    if (isBootstrapped.current) {
      return;
    }
    isBootstrapped.current = true;
    runBootstrap();
  }, [runBootstrap]);

  return { retry: runBootstrap, status };
}

export function useAppLists() {
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const applyBootstrap = useCallback((result: BootstrapResult): void => {
    setLists(result.lists);
    setActiveListId(result.lists[0]?.id ?? null);
    setCategories(result.categories);
  }, []);
  const { status, retry } = useBootstrap(applyBootstrap);

  useEffect(() => {
    if (lists.length > 0) {
      saveBootstrapCache(lists, categories);
    }
  }, [lists, categories]);

  // Общий сеттер lists/activeListId с fallback-логикой: если список
  // Оказался пуст (после удаления/выхода, либо у только что привязанного
  // Аккаунта), заводит список по умолчанию — тот же паттерн, что при
  // Онбординге нового аккаунта, вместо молчаливого опустошения экрана.
  const applyLists = async (
    fetchedLists: List[],
    selectId?: string,
  ): Promise<void> => {
    const nextLists =
      fetchedLists.length === 0
        ? [await createList('Мои покупки')]
        : fetchedLists;
    setLists(nextLists);
    setActiveListId((current) => {
      const preferred = selectId ?? current;
      return preferred && nextLists.some(({ id }) => id === preferred)
        ? preferred
        : (nextLists[0]?.id ?? null);
    });
  };

  // Перезапрашивает GET /lists после мутации (создание/переименование/удаление
  // Списка) — не hot path, ручной патч состояния не нужен.
  const refreshLists = async (selectId?: string): Promise<void> => {
    await applyLists(await getLists(), selectId);
  };

  // Редимпшн линк-кода меняет cookie этого устройства на другой аккаунт —
  // Сервер уже вернул полный bootstrap, второй round-trip не нужен. Списки
  // Старого аккаунта больше не будут перечитаны, поэтому их localStorage-кеш
  // (`kupi:list:<id>`) чистим здесь, иначе он остаётся в хранилище навсегда.
  const onAccountLinked = async (bootstrap: Bootstrap): Promise<void> => {
    lists.forEach(({ id }) => clearListCache(id));
    await applyLists(bootstrap.lists);
    setCategories(bootstrap.categories);
  };

  return {
    activeListId,
    categories,
    lists,
    onAccountLinked,
    refreshLists,
    retry,
    setActiveListId,
    status,
  };
}
