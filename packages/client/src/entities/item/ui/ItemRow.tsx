import type { ReactNode } from 'react';

import type { Item } from '@kupi/shared';

import {
  ActionIcon,
  Checkbox,
  Group,
  InputLabel,
  ListIcon,
  Stack,
  Text,
} from '@/shared/ui';

import styles from './styles.module.css';

type Props = {
  item: Item;
  categoryIcon?: ReactNode;
  editor?: ReactNode;
  onToggle: () => void;
  onOpen: () => void;
};

export function ItemRow({
  item,
  categoryIcon,
  editor,
  onToggle,
  onOpen,
}: Props) {
  const id = `item-row-${item.id}`;

  return (
    <Stack
      component="li"
      gap={0}
      className={styles.row}
    >
      <Group p={16}>
        <Checkbox
          id={id}
          checked={item.checked}
          onChange={onToggle}
        />
        <InputLabel
          td={item.checked ? 'line-through' : 'initial'}
          c={item.checked ? 'dimmed' : 'black'}
          htmlFor={id}
          size="md"
        >
          {item.name}
        </InputLabel>
        {item.quantity > 1 && <Text c="dimmed">({item.quantity})</Text>}
        {categoryIcon}
        <ActionIcon
          ml="auto"
          variant="gradient"
          aria-label={`Редактировать ${item.name}`}
          onClick={onOpen}
        >
          <ListIcon />
        </ActionIcon>
      </Group>
      {editor}
    </Stack>
  );
}
