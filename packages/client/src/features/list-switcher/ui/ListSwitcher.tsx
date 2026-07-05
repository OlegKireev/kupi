import type { List } from '@kupi/shared';

import { CodeShareModal, FilePlusIcon, KeyIcon } from '@/shared/ui';
import { useListSwitcher } from '../model/useListSwitcher';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListMenu } from './ListMenu';
import { TextPromptModal } from './TextPromptModal';

interface Props {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
}

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
    failedCount,
    initialCode,
    list,
    onDeepLinkConsumed,
    onListsChanged,
    pendingCount,
  });

  const isOwner = list.role === 'owner';

  return (
    <>
      <ListMenu
        list={list}
        lists={lists}
        isOwner={isOwner}
        syncStatusText={syncStatusText}
        memberCount={memberCount}
        onOpen={loadMemberCount}
        onSwitchList={onSwitchList}
        onInvite={openInvite}
        onRename={openRename}
        onDelete={openConfirmDelete}
        onNewList={openNewList}
        onJoinByCode={openCode}
      />

      <CodeShareModal
        opened={inviteModal !== null}
        onClose={closeInviteModal}
        title={inviteModal?.title ?? ''}
        url={inviteModal?.url ?? ''}
        code={inviteModal?.code ?? ''}
      />

      <TextPromptModal
        opened={renameOpen}
        onClose={closeRename}
        title="Переименовать список"
        value={renameValue}
        onChange={setRenameValue}
        onSubmit={submitRename}
        submitLabel="Сохранить"
      />

      <DeleteConfirmModal
        opened={confirmDeleteOpen}
        onClose={closeConfirmDelete}
        isOwner={isOwner}
        onConfirm={confirmDelete}
      />

      <TextPromptModal
        opened={newListOpen}
        onClose={closeNewList}
        title="Новый список"
        value={newListName}
        onChange={setNewListName}
        onSubmit={submitNewList}
        placeholder="Название списка"
        submitLabel="Создать"
        submitIcon={<FilePlusIcon />}
      />

      <TextPromptModal
        opened={codeOpen}
        onClose={closeCode}
        title="Присоединиться по коду списка"
        value={codeValue}
        onChange={setCodeValue}
        onSubmit={submitCode}
        placeholder="Код приглашения"
        submitLabel="Продолжить"
        submitIcon={<KeyIcon />}
      />
    </>
  );
}
