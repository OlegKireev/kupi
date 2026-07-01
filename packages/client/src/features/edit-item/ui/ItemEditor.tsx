import type { Category, Item, SyncResponse } from '@kupi/shared';
import { ActionIcon, Button, Chip, Group, Stack, Text } from '@/shared/ui';
import { useEditItem } from '../model/useEditItem';

type Props = {
  item: Item;
  categories: Category[];
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse) => void;
  onClose: () => void;
};

export function ItemEditor({
  item,
  categories,
  listId,
  lastSeenSeq,
  onSynced,
  onClose,
}: Props) {
  const { setQuantity, setCategory, deleteItem } = useEditItem({
    listId,
    lastSeenSeq,
    onSynced,
  });

  return (
    <Stack component="li">
      <Group p={'0 16px 16px'}>
        <Group
          gap="xs"
          wrap="nowrap"
        >
          <ActionIcon
            variant="default"
            aria-label="Уменьшить количество"
            onClick={() =>
              void setQuantity(item, Math.max(1, item.quantity - 1))
            }
          >
            −
          </ActionIcon>
          <Text>{item.quantity}</Text>
          <ActionIcon
            variant="default"
            aria-label="Увеличить количество"
            onClick={() => void setQuantity(item, item.quantity + 1)}
          >
            +
          </ActionIcon>
        </Group>
        <Button
          variant="subtle"
          color="red"
          ml="auto"
          size="compact-sm"
          onClick={() => {
            void deleteItem(item);
            onClose();
          }}
        >
          Удалить
        </Button>
        <Chip.Group
          multiple={false}
          value={item.categoryId}
          onChange={(value) => void setCategory(item, value as string)}
        >
          <Group
            className="item-editor__categories"
            gap="xs"
          >
            {categories.map((c) => (
              <Chip
                key={c.id}
                value={c.id}
              >
                {c.icon} {c.name}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </Group>
    </Stack>
  );
}
