import { useEffect, useRef, useState } from 'react';

import type { Bootstrap, Category, List } from '@kupi/shared';

import { getCategories } from '@/entities/category';
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

  // Перезапрашивает GET /lists после мутации (создание/переименование/удаление
  // списка) — не hot path, ручной патч состояния не нужен. Если после
  // удаления/выхода списков не осталось, создаёт список по умолчанию — тот же
  // паттерн, что при онбординге нового аккаунта.
  const refreshLists = async (selectId?: string): Promise<void> => {
    let fetchedLists = await getLists();
    if (fetchedLists.length === 0) {
      fetchedLists = [await createList('Мои покупки')];
    }
    setLists(fetchedLists);
    setActiveListId((current) => {
      const preferred = selectId ?? current;
      return preferred && fetchedLists.some((l) => l.id === preferred)
        ? preferred
        : fetchedLists[0]!.id;
    });
  };

  // Редимпшн линк-кода меняет cookie этого устройства на другой аккаунт —
  // сервер уже вернул полный bootstrap, второй round-trip не нужен.
  const onAccountLinked = (bootstrap: Bootstrap): void => {
    setLists(bootstrap.lists);
    setActiveListId(bootstrap.lists[0]?.id ?? null);
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
