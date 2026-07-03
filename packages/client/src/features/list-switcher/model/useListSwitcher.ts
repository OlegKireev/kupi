import { useState } from 'react';

import type { List } from '@kupi/shared';

import {
  createInvite,
  createList,
  deleteList,
  getMemberCount,
  joinList,
  renameList,
} from '@/entities/list';
import { ApiError } from '@/shared/api';
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import { notifications } from '@/shared/ui';
import { getSyncStatusText } from './sync-status';

type Params = {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
};

type InviteModalState = { title: string; code: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useListSwitcher({
  list,
  onListsChanged,
  pendingCount,
  failedCount,
}: Params) {
  const online = useOnlineStatus();
  const syncStatusText = getSyncStatusText(pendingCount, failedCount, online);

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [inviteModal, setInviteModal] = useState<InviteModalState>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');

  const loadMemberCount = (): void => {
    void getMemberCount(list.id).then(setMemberCount);
  };

  const openInvite = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setInviteModal({ title: 'Код приглашения', code });
  };

  const closeInviteModal = (): void => setInviteModal(null);

  const openRename = (): void => {
    setRenameValue(list.name);
    setRenameOpen(true);
  };
  const closeRename = (): void => setRenameOpen(false);

  const submitRename = async (): Promise<void> => {
    const name = renameValue.trim();
    if (!name) {
      return;
    }
    await renameList(list.id, name);
    setRenameOpen(false);
    onListsChanged();
  };

  const openConfirmDelete = (): void => setConfirmDeleteOpen(true);
  const closeConfirmDelete = (): void => setConfirmDeleteOpen(false);

  const confirmDelete = async (): Promise<void> => {
    await deleteList(list.id);
    setConfirmDeleteOpen(false);
    onListsChanged();
  };

  const openNewList = (): void => setNewListOpen(true);
  const closeNewList = (): void => setNewListOpen(false);

  const submitNewList = async (): Promise<void> => {
    const name = newListName.trim();
    if (!name) {
      return;
    }
    const created = await createList(name);
    setNewListName('');
    setNewListOpen(false);
    onListsChanged(created.id);
  };

  const openCode = (): void => {
    setCodeValue('');
    setCodeOpen(true);
  };
  const closeCode = (): void => setCodeOpen(false);

  const submitCode = async (): Promise<void> => {
    try {
      const joined: List = await joinList(codeValue);
      setCodeOpen(false);
      onListsChanged(joined.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
        return;
      }
      throw err;
    }
  };

  return {
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
  };
}
