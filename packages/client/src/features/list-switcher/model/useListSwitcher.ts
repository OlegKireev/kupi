import { useEffect, useRef, useState } from 'react';

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
import { buildDeepLink } from '@/shared/lib/deep-link';
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import { notifications } from '@/shared/ui';
import { getSyncStatusText } from './sync-status';

interface Params {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
}

type InviteModalState = { title: string; code: string; url: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useListSwitcher({
  list,
  onListsChanged,
  pendingCount,
  failedCount,
  initialCode,
  onDeepLinkConsumed,
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

  // Диплинк (?listCode=...) предзаполняет и открывает ту же модалку, что
  // открыл бы ручной ввод — тап по «Продолжить» и есть подтверждение.
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || !initialCode) {
      return;
    }
    deepLinkConsumed.current = true;
    setCodeValue(initialCode);
    setCodeOpen(true);
    onDeepLinkConsumed();
  }, [initialCode, onDeepLinkConsumed]);

  const loadMemberCount = (): void => {
    getMemberCount(list.id).then(setMemberCount);
  };

  const openInvite = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setInviteModal({
      code,
      title: 'Код приглашения',
      url: buildDeepLink('list', code),
    });
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
    closeCode,
    closeConfirmDelete,
    closeInviteModal,
    closeNewList,
    closeRename,
    codeOpen,
    codeValue,
    confirmDelete,
    confirmDeleteOpen,
    inviteModal,
    loadMemberCount,
    memberCount,
    newListName,
    newListOpen,
    openCode,
    openConfirmDelete,
    openInvite,
    openNewList,
    openRename,
    renameOpen,
    renameValue,
    setCodeValue,
    setNewListName,
    setRenameValue,
    submitCode,
    submitNewList,
    submitRename,
    syncStatusText,
  };
}
