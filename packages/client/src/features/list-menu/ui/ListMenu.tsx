import { Copy, DotsThreeVertical, Trash } from '@phosphor-icons/react';

import type { List } from '@kupi/shared';

import { ActionIcon, Button, Menu, Modal, Text, TextInput } from '@/shared/ui';
import { useListMenu } from '../model/useListMenu';

type Props = {
  list: List;
  onListsChanged: (selectId?: string) => void;
};

export function ListMenu({ list, onListsChanged }: Props) {
  const {
    memberCount,
    codeModal,
    renameOpen,
    renameValue,
    confirmDeleteOpen,
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
  } = useListMenu({ list, onListsChanged });

  return (
    <>
      <Menu onOpen={loadMemberCount}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            aria-label="Меню списка"
          >
            <DotsThreeVertical size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => void openInvite()}>Пригласить</Menu.Item>
          <Menu.Item disabled>Участники ({memberCount ?? '…'})</Menu.Item>
          <Menu.Item onClick={() => void openLinkDevice()}>
            Подключить устройство
          </Menu.Item>
          <Menu.Item onClick={openRename}>Переименовать список</Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<Trash size={16} />}
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
          leftSection={<Copy size={16} />}
          onClick={() =>
            void navigator.clipboard.writeText(codeModal?.code ?? '')
          }
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
          onClick={() => void submitRename()}
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
          onClick={() => void confirmDelete()}
        >
          Подтвердить
        </Button>
      </Modal>
    </>
  );
}
