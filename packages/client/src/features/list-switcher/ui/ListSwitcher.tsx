import type { List } from '@kupi/shared';

import {
  Button,
  CaretDownIcon,
  CheckIcon,
  CodeShareModal,
  FilePlusIcon,
  Group,
  KeyIcon,
  Menu,
  Modal,
  Text,
  TextboxIcon,
  TextInput,
  Title,
  TrashIcon,
  UnstyledButton,
  UserPlusIcon,
  UsersFourIcon,
} from '@/shared/ui';
import { useListSwitcher } from '../model/useListSwitcher';
import styles from './styles.module.css';

type Props = {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
};

export function ListSwitcher({
  list,
  lists,
  onSwitchList,
  onListsChanged,
  pendingCount,
  failedCount,
  initialCode,
  onDeepLinkConsumed,
}: Props) {
  const {
    syncStatusText,
    memberCount,
    loadMemberCount,
    inviteModal,
    openInvite,
    closeInviteModal,
    renameOpen,
    renameValue,
    setRenameValue,
    openRename,
    closeRename,
    submitRename,
    confirmDeleteOpen,
    openConfirmDelete,
    closeConfirmDelete,
    confirmDelete,
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
  } = useListSwitcher({
    list,
    onListsChanged,
    pendingCount,
    failedCount,
    initialCode,
    onDeepLinkConsumed,
  });

  const isOwner = list.role === 'owner';

  return (
    <>
      <Menu onOpen={loadMemberCount}>
        <Menu.Target>
          <UnstyledButton className={styles.menuTrigger}>
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
              <CaretDownIcon
                size={20}
                className={styles.caretIcon}
              />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{syncStatusText}</Menu.Label>
          {isOwner && (
            <Menu.Item
              leftSection={<UserPlusIcon size={16} />}
              onClick={openInvite}
            >
              Пригласить в список
            </Menu.Item>
          )}
          <Menu.Item
            disabled
            leftSection={<UsersFourIcon size={16} />}
          >
            Участники ({memberCount ?? '…'})
          </Menu.Item>
          {isOwner && (
            <Menu.Item
              leftSection={<TextboxIcon size={16} />}
              onClick={openRename}
            >
              Переименовать список
            </Menu.Item>
          )}
          <Menu.Item
            color="red"
            leftSection={<TrashIcon size={16} />}
            onClick={openConfirmDelete}
          >
            {isOwner ? 'Удалить список' : 'Покинуть список'}
          </Menu.Item>
          <Menu.Divider />
          {lists.map((l) => (
            <Menu.Item
              key={l.id}
              leftSection={
                l.role === 'member' ? <UsersFourIcon size={14} /> : undefined
              }
              rightSection={l.id === list.id ? <CheckIcon size={16} /> : null}
              onClick={() => onSwitchList(l.id)}
            >
              {l.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            leftSection={<FilePlusIcon size={16} />}
            onClick={openNewList}
          >
            Новый список
          </Menu.Item>
          <Menu.Item
            leftSection={<KeyIcon size={16} />}
            onClick={openCode}
          >
            Присоединиться по коду списка
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <CodeShareModal
        opened={inviteModal !== null}
        onClose={closeInviteModal}
        title={inviteModal?.title ?? ''}
        url={inviteModal?.url ?? ''}
        code={inviteModal?.code ?? ''}
      />

      <Modal
        opened={renameOpen}
        onClose={closeRename}
        title="Переименовать список"
      >
        <TextInput
          value={renameValue}
          onChange={(e) => setRenameValue(e.currentTarget.value)}
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          onClick={submitRename}
        >
          Сохранить
        </Button>
      </Modal>

      <Modal
        opened={confirmDeleteOpen}
        onClose={closeConfirmDelete}
        title={isOwner ? 'Удалить список?' : 'Покинуть список?'}
      >
        <Text>
          {isOwner
            ? 'Список удалится для всех участников.'
            : 'Вы выйдете из списка, для остальных участников он останется.'}
        </Text>
        <Button
          mt="md"
          fullWidth
          color="red"
          onClick={confirmDelete}
        >
          Подтвердить
        </Button>
      </Modal>

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
        title="Присоединиться по коду списка"
      >
        <TextInput
          value={codeValue}
          onChange={(e) => setCodeValue(e.currentTarget.value)}
          placeholder="Код приглашения"
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
    </>
  );
}
