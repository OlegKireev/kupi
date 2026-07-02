import type { List } from '@kupi/shared';

import {
  ActionIcon,
  Button,
  Menu,
  Modal,
  Text,
  TextInput,
  CopyIcon,
  DotsThreeVerticalIcon,
  TrashIcon,
  UserPlusIcon,
  UsersFourIcon,
  DevicesIcon,
  TextboxIcon,
} from '@/shared/ui';
import { useListMenu } from '../model/useListMenu';

type Props = {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
};

export function ListMenu({ list, onListsChanged, pendingCount, failedCount }: Props) {
  const {
    memberCount,
    codeModal,
    renameOpen,
    renameValue,
    confirmDeleteOpen,
    syncStatusText,
    loadMemberCount,
    openInvite,
    openLinkDevice,
    closeCodeModal,
    openRename,
    closeRename,
    setRenameValue,
    submitRename,
    openConfirmDelete,
    closeConfirmDelete,
    confirmDelete,
  } = useListMenu({ list, onListsChanged, pendingCount, failedCount });

  return (
    <>
      <Menu onOpen={loadMemberCount}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            aria-label="Меню списка"
          >
            <DotsThreeVerticalIcon size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{syncStatusText}</Menu.Label>
          <Menu.Item
            leftSection={<UserPlusIcon size={16} />}
            onClick={openInvite}
          >
            Пригласить
          </Menu.Item>
          <Menu.Item
            disabled
            leftSection={<UsersFourIcon size={16} />}
          >
            Участники ({memberCount ?? '…'})
          </Menu.Item>
          <Menu.Item
            leftSection={<DevicesIcon size={16} />}
            onClick={openLinkDevice}
          >
            Подключить устройство
          </Menu.Item>
          <Menu.Item
            leftSection={<TextboxIcon size={16} />}
            onClick={openRename}
          >
            Переименовать список
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<TrashIcon size={16} />}
            onClick={openConfirmDelete}
          >
            Удалить/покинуть список
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={codeModal !== null}
        onClose={closeCodeModal}
        title={codeModal?.title}
      >
        <Text
          size="xl"
          fw={700}
          ta="center"
        >
          {codeModal?.code}
        </Text>
        <Button
          mt="md"
          fullWidth
          leftSection={<CopyIcon size={16} />}
          onClick={() => navigator.clipboard.writeText(codeModal?.code ?? '')}
        >
          Копировать
        </Button>
      </Modal>

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
        title="Удалить/покинуть список?"
      >
        <Text>
          Если вы владелец — список удалится для всех участников. Если вы
          участник — вы просто выйдете из него.
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
    </>
  );
}
