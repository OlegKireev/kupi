import { useMemo, useState } from 'react';

import type { Bootstrap, Category, List } from '@kupi/shared';

import { CategoryIcon } from '@/entities/category';
import { ItemRow, useItemSync } from '@/entities/item';
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
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
};

export function ListScreen({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
}: Props) {
  const { items, pendingCount, failedCount, applyChange } = useItemSync(
    list.id,
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => Number(a.checked) - Number(b.checked)),
    [items],
  );

  const toggle = useToggleItem({ applyChange });

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
          onAccountLinked={onAccountLinked}
        />
        <ListMenu
          list={list}
          onListsChanged={onListsChanged}
          pendingCount={pendingCount}
          failedCount={failedCount}
        />
      </Group>
      <AddItemInput applyChange={applyChange} />
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
                  applyChange={applyChange}
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
