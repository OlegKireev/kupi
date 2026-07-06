import type { List } from '@kupi/shared';

import {
  CodeShareModal,
  FilePlusIcon,
  KeyIcon,
  TextPromptModal,
} from '@/shared/ui';
import { useListSwitcher } from '../model/useListSwitcher';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListMenu } from './ListMenu';

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
  const { syncStatusText, invite, rename, deleteConfirm, newList, joinByCode } =
    useListSwitcher({
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
        memberCount={invite.memberCount}
        onOpen={invite.handleLoadMembers}
        onSwitchList={onSwitchList}
        onInvite={invite.handleOpen}
        onRename={rename.handleOpen}
        onDelete={deleteConfirm.handleOpen}
        onNewList={newList.handleOpen}
        onJoinByCode={joinByCode.handleOpen}
      />

      <CodeShareModal
        opened={invite.modal !== null}
        onClose={invite.handleClose}
        title={invite.modal?.title ?? ''}
        url={invite.modal?.url ?? ''}
        code={invite.modal?.code ?? ''}
      />

      <TextPromptModal
        opened={rename.isOpen}
        onClose={rename.handleClose}
        title="Переименовать список"
        value={rename.value}
        onChange={rename.handleChange}
        onSubmit={rename.handleSubmit}
        loading={rename.isLoading}
        submitLabel="Сохранить"
      />

      <DeleteConfirmModal
        opened={deleteConfirm.isOpen}
        onClose={deleteConfirm.handleClose}
        isOwner={isOwner}
        onConfirm={deleteConfirm.handleSubmit}
        loading={deleteConfirm.isLoading}
      />

      <TextPromptModal
        opened={newList.isOpen}
        onClose={newList.handleClose}
        title="Новый список"
        value={newList.value}
        onChange={newList.handleChange}
        onSubmit={newList.handleSubmit}
        loading={newList.isLoading}
        placeholder="Название списка"
        submitLabel="Создать"
        submitIcon={<FilePlusIcon />}
      />

      <TextPromptModal
        opened={joinByCode.isOpen}
        onClose={joinByCode.handleClose}
        title="Присоединиться по коду списка"
        value={joinByCode.value}
        onChange={joinByCode.handleChange}
        onSubmit={joinByCode.handleSubmit}
        loading={joinByCode.isLoading}
        placeholder="Код приглашения"
        submitLabel="Продолжить"
        submitIcon={<KeyIcon />}
      />
    </>
  );
}
