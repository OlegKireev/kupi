import type { Category, Item, ItemChange } from '@kupi/shared';
import {
  ActionIcon,
  Button,
  Chip,
  Group,
  Stack,
  Text,
  TrashIcon,
} from '@/shared/ui';
import { useEditItem } from '../model/useEditItem';

type Props = {
  item: Item;
  categories: Category[];
  applyChange: (change: ItemChange) => void;
  onClose: () => void;
};

export function ItemEditor({ item, categories, applyChange, onClose }: Props) {
  const { setQuantity, setCategory, deleteItem } = useEditItem({ applyChange });

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
            onClick={() => setQuantity(item, Math.max(1, item.quantity - 1))}
          >
            −
          </ActionIcon>
          <Text>{item.quantity}</Text>
          <ActionIcon
            variant="default"
            aria-label="Увеличить количество"
            onClick={() => setQuantity(item, item.quantity + 1)}
          >
            +
          </ActionIcon>
        </Group>
        <Button
          variant="subtle"
          color="red"
          ml="auto"
          leftSection={<TrashIcon />}
          size="compact-sm"
          onClick={() => {
            deleteItem(item);
            onClose();
          }}
        >
          Удалить
        </Button>
        <Chip.Group
          multiple={false}
          value={item.categoryId}
          onChange={(value) => setCategory(item, value)}
        >
          <Group gap="xs">
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
