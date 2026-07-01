import { useEffect, useMemo, useState } from 'react';
import type { Category, Item, List, SyncResponse } from '@kupi/shared';
import { CategoryIcon } from '@/entities/category';
import { ItemRow, mergeItems, syncItems } from '@/entities/item';
import { AddItemInput } from '@/features/add-item';
import { ItemEditor } from '@/features/edit-item';
import { ListMenu } from '@/features/list-menu';
import { ListSwitcher } from '@/features/list-switcher';
import { useToggleItem } from '@/features/toggle-item';
import { Group, List as ListComponent, Stack, Text } from '@/shared/ui';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
};

export function ListScreen({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [lastSeenSeq, setLastSeenSeq] = useState(0);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => Number(a.checked) - Number(b.checked)),
    [items],
  );

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
    setItems([]);
    setLastSeenSeq(0);
    syncItems(list.id, { lastSeenSeq: 0, changes: [] }).then(onSynced);
  }, [list.id]);

  const toggle = useToggleItem({ listId: list.id, lastSeenSeq, onSynced });

  return (
    <Stack p={12}>
      <Group
        justify="space-between"
        wrap="nowrap"
      >
        <ListSwitcher
          list={list}
          lists={lists}
          onSwitchList={onSwitchList}
          onListsChanged={onListsChanged}
        />
        <ListMenu
          list={list}
          onListsChanged={onListsChanged}
        />
      </Group>
      <AddItemInput
        listId={list.id}
        lastSeenSeq={lastSeenSeq}
        onSynced={onSyncedPinned}
      />
      {sortedItems.length === 0 && (
        <Text c="dimmed">
          Список пуст. Начни печатать выше — появятся подсказки из твоих частых
          покупок.
        </Text>
      )}
      <ListComponent pl={0}>
        {sortedItems.map((item) => (
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
