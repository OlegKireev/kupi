import { useState } from 'react';
import type { List } from '@kupi/shared';
import { createList } from '@/entities/list';
import {
  Button,
  Group,
  Menu,
  Modal,
  TextInput,
  Title,
  UnstyledButton,
  CaretDownIcon,
  FilePlusIcon,
} from '@/shared/ui';

type Props = {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
};

export function ListSwitcher({
  list,
  lists,
  onSwitchList,
  onListsChanged,
}: Props) {
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  const submitNewList = async (): Promise<void> => {
    const name = newListName.trim();
    if (!name) return;
    const created = await createList(name);
    setNewListName('');
    setNewListOpen(false);
    onListsChanged(created.id);
  };

  return (
    <>
      <Menu>
        <Menu.Target>
          <UnstyledButton>
            <Group
              gap={8}
              wrap="nowrap"
            >
              <Title
                order={1}
                size="h2"
              >
                {list.name}
              </Title>
              <CaretDownIcon size={20} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {lists.map((l) => (
            <Menu.Item
              key={l.id}
              onClick={() => onSwitchList(l.id)}
            >
              {l.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item onClick={() => setNewListOpen(true)}>
            Новый список
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={newListOpen}
        onClose={() => setNewListOpen(false)}
        title="Новый список"
      >
        <TextInput
          value={newListName}
          onChange={(e) => setNewListName(e.currentTarget.value)}
          placeholder="Название списка"
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          leftSection={<FilePlusIcon />}
          onClick={submitNewList}
        >
          Создать
        </Button>
      </Modal>
    </>
  );
}
