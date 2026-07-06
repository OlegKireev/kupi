import type { Category, Item, ItemChange } from '@kupi/shared';

import {
  ActionIcon,
  Button,
  Flex,
  Group,
  Stack,
  Text,
  TrashIcon,
} from '@/shared/ui';
import { useEditItem } from '../model/useEditItem';
import { CategoryChips } from './CategoryChips';

interface Props {
  item: Item;
  categories: Category[];
  applyChange: (change: ItemChange) => void;
  onClose: () => void;
}

export function ItemEditor({ item, categories, applyChange, onClose }: Props) {
  const { setQuantity, setCategory, deleteItem } = useEditItem({ applyChange });

  return (
    <Stack>
      <Group p="0 16px 16px">
        <Group
          gap="xs"
          wrap="nowrap"
        >
          <ActionIcon
            variant="default"
            aria-label="Уменьшить количество"
            onClick={() => setQuantity(item, Math.max(1, item.quantity - 1))}
          >
            -
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
        <Flex flex="1 1 100%">
          <CategoryChips
            categories={categories}
            selectedCategoryId={item.categoryId}
            onChange={(value) => setCategory(item, value)}
            onChipClick={(event) => {
              if (event.currentTarget.value === item.categoryId) {
                setCategory(item, null);
              }
            }}
          />
        </Flex>
      </Group>
    </Stack>
  );
}
