import type { Bootstrap, List } from '@kupi/shared';
import { useListSwitcher } from '../model/useListSwitcher';
import {
  Button,
  Group,
  Menu,
  Modal,
  Text,
  TextInput,
  Title,
  UnstyledButton,
  CaretDownIcon,
  FilePlusIcon,
  KeyIcon,
} from '@/shared/ui';

type Props = {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => void;
};

export function ListSwitcher({
  list,
  lists,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
}: Props) {
  const {
    newListOpen,
    newListName,
    setNewListName,
    openNewList,
    closeNewList,
    submitNewList,
    codeOpen,
    codeValue,
    setCodeValue,
    openCode,
    closeCode,
    submitCode,
    pendingLinkCode,
    cancelLinkDevice,
    confirmLinkDevice,
  } = useListSwitcher({ onListsChanged, onAccountLinked });

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
          <Menu.Item onClick={openNewList}>Новый список</Menu.Item>
          <Menu.Item
            leftSection={<KeyIcon size={16} />}
            onClick={openCode}
          >
            Ввести код
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={newListOpen}
        onClose={closeNewList}
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

      <Modal
        opened={codeOpen}
        onClose={closeCode}
        title="Ввести код"
      >
        <TextInput
          value={codeValue}
          onChange={(e) => setCodeValue(e.currentTarget.value)}
          placeholder="Код приглашения или устройства"
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          leftSection={<KeyIcon />}
          onClick={submitCode}
        >
          Продолжить
        </Button>
      </Modal>

      <Modal
        opened={pendingLinkCode !== null}
        onClose={cancelLinkDevice}
        title="Подключить устройство?"
      >
        <Text>
          Это заменит аккаунт этого устройства. Текущие списки станут
          недоступны с него. Продолжить?
        </Text>
        <Button
          mt="md"
          fullWidth
          color="red"
          onClick={confirmLinkDevice}
        >
          Подключить
        </Button>
      </Modal>
    </>
  );
}
