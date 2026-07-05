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
import { handleInvalidCodeError } from '@/shared/api';
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

/** Модалка приглашения в список — вынесена отдельно, чтобы useListSwitcher
 * укладывался в max-statements. */
function useInviteModal(list: List) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [inviteModal, setInviteModal] = useState<InviteModalState>(null);

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

  return {
    closeInviteModal,
    inviteModal,
    loadMemberCount,
    memberCount,
    openInvite,
  };
}

/** Переименование списка. */
function useRenameList(
  list: List,
  onListsChanged: (selectId?: string) => void,
) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);

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

  return {
    closeRename,
    openRename,
    renameOpen,
    renameValue,
    setRenameValue,
    submitRename,
  };
}

/** Подтверждение удаления/выхода из списка (см. lists/routes.ts —
 * DELETE /lists/:id ветвится по роли только на сервере). */
function useDeleteList(
  list: List,
  onListsChanged: (selectId?: string) => void,
) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const openConfirmDelete = (): void => setConfirmDeleteOpen(true);
  const closeConfirmDelete = (): void => setConfirmDeleteOpen(false);

  const confirmDelete = async (): Promise<void> => {
    await deleteList(list.id);
    setConfirmDeleteOpen(false);
    onListsChanged();
  };

  return {
    closeConfirmDelete,
    confirmDelete,
    confirmDeleteOpen,
    openConfirmDelete,
  };
}

/** Создание нового списка. */
function useNewList(onListsChanged: (selectId?: string) => void) {
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
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

  return {
    closeNewList,
    newListName,
    newListOpen,
    openNewList,
    setNewListName,
    submitNewList,
  };
}

/** Присоединение по коду приглашения — плюс диплинк (?listCode=...),
 * который предзаполняет и открывает ту же модалку, что и ручной ввод. */
function useJoinByCode(
  initialCode: string | undefined,
  onDeepLinkConsumed: () => void,
  onListsChanged: (selectId?: string) => void,
) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');

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
      handleInvalidCodeError(err, () => {
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
      });
    }
  };

  return { closeCode, codeOpen, codeValue, openCode, setCodeValue, submitCode };
}

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

  const invite = useInviteModal(list);
  const rename = useRenameList(list, onListsChanged);
  const deleteConfirm = useDeleteList(list, onListsChanged);
  const newList = useNewList(onListsChanged);
  const joinByCode = useJoinByCode(
    initialCode,
    onDeepLinkConsumed,
    onListsChanged,
  );

  return {
    syncStatusText,
    ...invite,
    ...rename,
    ...deleteConfirm,
    ...newList,
    ...joinByCode,
  };
}
