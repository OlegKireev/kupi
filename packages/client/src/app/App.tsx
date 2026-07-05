import { useEffect, useRef, useState } from 'react';

import type { Bootstrap, Category, List } from '@kupi/shared';

import { getCategories } from '@/entities/category';
import { clearListCache } from '@/entities/item';
import { createAccount, createList, getLists } from '@/entities/list';
import { ListScreenPage } from '@/pages/list-screen';
import { ApiError } from '@/shared/api';
import { parseDeepLink, type DeepLink } from '@/shared/lib/deep-link';
import {
  loadBootstrapCache,
  saveBootstrapCache,
} from './model/bootstrap-cache';

export function App() {
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deepLink, setDeepLink] = useState<DeepLink | null>(null);
  const bootstrapped = useRef(false);
  const deepLinkParsed = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;
    (async () => {
      try {
        const [fetchedLists, cats] = await Promise.all([
          getLists(),
          getCategories(),
        ]);
        setLists(fetchedLists);
        setActiveListId(fetchedLists[0]?.id ?? null);
        setCategories(cats);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const bootstrap = await createAccount();
          setLists(bootstrap.lists);
          setActiveListId(bootstrap.lists[0]?.id ?? null);
          setCategories(bootstrap.categories);
          return;
        }
        if (!(err instanceof ApiError)) {
          const cached = loadBootstrapCache();
          if (cached) {
            setLists(cached.lists);
            setActiveListId(cached.lists[0]?.id ?? null);
            setCategories(cached.categories);
            return;
          }
        }
        throw err;
      }
    })();
  }, []);

  // Диплинк (?listCode=.../?deviceCode=...) читается один раз при старте —
  // Тот же useRef-guard, что и у bootstrap-эффекта, против двойного вызова
  // В React StrictMode. URL сбрасывается целиком (других query-параметров у
  // Приложения сейчас нет), чтобы обновление страницы не открывало модалку
  // Повторно.
  useEffect(() => {
    if (deepLinkParsed.current) {
      return;
    }
    deepLinkParsed.current = true;
    const parsed = parseDeepLink(window.location.search);
    if (parsed) {
      setDeepLink(parsed);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

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

  const activeList = lists.find(({ id }) => id === activeListId);
  if (!activeList) {
    return null;
  }

  return (
    <ListScreenPage
      key={activeList.id}
      list={activeList}
      lists={lists}
      categories={categories}
      onSwitchList={setActiveListId}
      onListsChanged={refreshLists}
      onAccountLinked={onAccountLinked}
      initialListCode={deepLink?.kind === 'list' ? deepLink.code : undefined}
      initialDeviceCode={
        deepLink?.kind === 'device' ? deepLink.code : undefined
      }
      onDeepLinkConsumed={() => setDeepLink(null)}
    />
  );
}
