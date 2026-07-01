import { useEffect, useState } from 'react';
import type { Category, Item, List, SyncResponse } from '@kupi/shared';
import { CategoryIcon } from '@/entities/category';
import { ItemRow, mergeItems, syncItems } from '@/entities/item';
import { AddItemInput } from '@/features/add-item';
import { ItemEditor } from '@/features/edit-item';
import { useToggleItem } from '@/features/toggle-item';
import { List as ListComponent, Stack, Text, Title } from '@/shared/ui';

type Props = { list: List; categories: Category[] };

export function ListScreen({ list, categories }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [lastSeenSeq, setLastSeenSeq] = useState(0);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const onSynced = (response: SyncResponse): void => {
    setItems((current) => mergeItems(current, response.items));
    setLastSeenSeq(response.seq);
  };

  const onSyncedPinned = (response: SyncResponse, pinItemId: string): void => {
    setItems((current) => {
      const merged = mergeItems(current, response.items);
      const pinned = merged.find((item) => item.id === pinItemId);
      return pinned
        ? [pinned, ...merged.filter((item) => item.id !== pinItemId)]
        : merged;
    });
    setLastSeenSeq(response.seq);
  };

  useEffect(() => {
    syncItems(list.id, { lastSeenSeq: 0, changes: [] }).then(onSynced);
  }, [list.id]);

  const toggle = useToggleItem({ listId: list.id, lastSeenSeq, onSynced });

  return (
    <Stack p={12}>
      <Title
        order={1}
        size="h1"
      >
        {list.name}
      </Title>
      <AddItemInput
        listId={list.id}
        lastSeenSeq={lastSeenSeq}
        onSynced={onSyncedPinned}
      />
      {items.length === 0 && (
        <Text c="dimmed">
          Список пуст. Начни печатать выше — появятся подсказки из твоих частых
          покупок.
        </Text>
      )}
      <ListComponent pl={0}>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            categoryIcon={
              <CategoryIcon
                category={categories.find((c) => c.id === item.categoryId)}
              />
            }
            editor={
              item.id === expandedItemId ? (
                <ItemEditor
                  key={item.id}
                  item={item}
                  categories={categories}
                  listId={list.id}
                  lastSeenSeq={lastSeenSeq}
                  onSynced={onSynced}
                  onClose={() => setExpandedItemId(null)}
                />
              ) : null
            }
            onToggle={() => toggle(item)}
            onOpen={() =>
              setExpandedItemId(item.id === expandedItemId ? null : item.id)
            }
          />
        ))}
      </ListComponent>
    </Stack>
  );
}
