import { useEffect, useRef, useState } from 'react';
import type { Category, List } from '@kupi/shared';
import { createAccount, getLists } from '@/entities/list';
import { getCategories } from '@/entities/category';
import { ListScreenPage } from '@/pages/list-screen';
import { ApiError } from '@/shared/api';

export function App() {
  const [list, setList] = useState<List | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        const [lists, cats] = await Promise.all([getLists(), getCategories()]);
        setList(lists[0]!);
        setCategories(cats);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const bootstrap = await createAccount();
          setList(bootstrap.lists[0]!);
          setCategories(bootstrap.categories);
          return;
        }
        throw err;
      }
    })();
  }, []);

  if (!list) return null;
  return <ListScreenPage list={list} categories={categories} />;
}
