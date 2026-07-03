import { useEffect, useRef, useState } from 'react';

import type { Bootstrap, Category, List } from '@kupi/shared';

import { getCategories } from '@/entities/category';
import { clearListCache } from '@/entities/item';
import { createAccount, createList, getLists } from '@/entities/list';
import { ListScreenPage } from '@/pages/list-screen';
import { ApiError } from '@/shared/api';
import {
  loadBootstrapCache,
  saveBootstrapCache,
} from './model/bootstrap-cache';

export function App() {
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const bootstrapped = useRef(false);

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

  useEffect(() => {
    if (lists.length > 0) {
      saveBootstrapCache(lists, categories);
    }
  }, [lists, categories]);

  // Общий сеттер lists/activeListId с fallback-логикой: если список
  // оказался пуст (после удаления/выхода, либо у только что привязанного
  // аккаунта), заводит список по умолчанию — тот же паттерн, что при
  // онбординге нового аккаунта, вместо молчаливого опустошения экрана.
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
      return preferred && nextLists.some((l) => l.id === preferred)
        ? preferred
        : nextLists[0]!.id;
    });
  };

  // Перезапрашивает GET /lists после мутации (создание/переименование/удаление
  // списка) — не hot path, ручной патч состояния не нужен.
  const refreshLists = async (selectId?: string): Promise<void> => {
    await applyLists(await getLists(), selectId);
  };

  // Редимпшн линк-кода меняет cookie этого устройства на другой аккаунт —
  // сервер уже вернул полный bootstrap, второй round-trip не нужен. Списки
  // старого аккаунта больше не будут перечитаны, поэтому их localStorage-кеш
  // (`kupi:list:<id>`) чистим здесь, иначе он остаётся в хранилище навсегда.
  const onAccountLinked = async (bootstrap: Bootstrap): Promise<void> => {
    lists.forEach((l) => clearListCache(l.id));
    await applyLists(bootstrap.lists);
    setCategories(bootstrap.categories);
  };

  const activeList = lists.find((l) => l.id === activeListId);
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
    />
  );
}
