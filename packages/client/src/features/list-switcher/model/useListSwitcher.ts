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
import { notifyInvalidCode } from '@/shared/lib/notify';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import type { CodeShareModalState } from '@/shared/ui';
import { getSyncStatusText } from './sync-status';

interface Params {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
}

/** Приглашение в список + счётчик участников. */
function useInviteModal(list: List) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [modal, setModal] = useState<CodeShareModalState | null>(null);

  const handleLoadMembers = (): void => {
    // Best-effort: счётчик подгружается на открытие меню. Сбой оставляет «…»,
    // а не сыплет глобальным тостом за само открытие меню.
    getMemberCount(list.id)
      .then(setMemberCount)
      .catch(() => undefined);
  };

  const handleOpen = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setModal({
      code,
      title: 'Код приглашения',
      url: buildDeepLink('list', code),
    });
  };

  const handleClose = (): void => setModal(null);

  return { handleClose, handleLoadMembers, handleOpen, memberCount, modal };
}

/** Переименование списка. */
function useRenameList(
  list: List,
  onListsChanged: (selectId?: string) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(list.name);

  const handleOpen = (): void => {
    setValue(list.name);
    setIsOpen(true);
  };
  const handleClose = (): void => setIsOpen(false);

  const submit = async (): Promise<void> => {
    const name = value.trim();
    if (!name) {
      return;
    }
    await renameList(list.id, name);
    setIsOpen(false);
    onListsChanged();
  };
  const { run: handleSubmit, isLoading } = useAsyncAction(submit);

  return {
    handleChange: setValue,
    handleClose,
    handleOpen,
    handleSubmit,
    isLoading,
    isOpen,
    value,
  };
}

/** Подтверждение удаления/выхода из списка (см. lists/routes.ts —
 * DELETE /lists/:id ветвится по роли только на сервере). */
function useDeleteList(
  list: List,
  onListsChanged: (selectId?: string) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = (): void => setIsOpen(true);
  const handleClose = (): void => setIsOpen(false);

  const submit = async (): Promise<void> => {
    await deleteList(list.id);
    setIsOpen(false);
    onListsChanged();
  };
  const { run: handleSubmit, isLoading } = useAsyncAction(submit);

  return { handleClose, handleOpen, handleSubmit, isLoading, isOpen };
}

/** Создание нового списка. */
function useNewList(onListsChanged: (selectId?: string) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const handleOpen = (): void => setIsOpen(true);
  const handleClose = (): void => setIsOpen(false);

  const submit = async (): Promise<void> => {
    const name = value.trim();
    if (!name) {
      return;
    }
    const created = await createList(name);
    setValue('');
    setIsOpen(false);
    onListsChanged(created.id);
  };
  const { run: handleSubmit, isLoading } = useAsyncAction(submit);

  return {
    handleChange: setValue,
    handleClose,
    handleOpen,
    handleSubmit,
    isLoading,
    isOpen,
    value,
  };
}

/** Присоединение по коду приглашения — плюс диплинк (?listCode=...),
 * который предзаполняет и открывает ту же модалку, что и ручной ввод. */
function useJoinByCode(
  initialCode: string | undefined,
  onDeepLinkConsumed: () => void,
  onListsChanged: (selectId?: string) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');

  const hasConsumedDeepLink = useRef(false);
  useEffect(() => {
    if (hasConsumedDeepLink.current || !initialCode) {
      return;
    }
    hasConsumedDeepLink.current = true;
    setValue(initialCode);
    setIsOpen(true);
    onDeepLinkConsumed();
  }, [initialCode, onDeepLinkConsumed]);

  const handleOpen = (): void => {
    setValue('');
    setIsOpen(true);
  };
  const handleClose = (): void => setIsOpen(false);

  const submit = async (): Promise<void> => {
    const code = value.trim();
    if (!code) {
      return;
    }
    try {
      const joined: List = await joinList(code);
      setIsOpen(false);
      onListsChanged(joined.id);
    } catch (err) {
      handleInvalidCodeError(err, notifyInvalidCode);
    }
  };
  const { run: handleSubmit, isLoading } = useAsyncAction(submit);

  return {
    handleChange: setValue,
    handleClose,
    handleOpen,
    handleSubmit,
    isLoading,
    isOpen,
    value,
  };
}

export function useListSwitcher({
  list,
  onListsChanged,
  pendingCount,
  failedCount,
  initialCode,
  onDeepLinkConsumed,
}: Params) {
  const isOnline = useOnlineStatus();
  const syncStatusText = getSyncStatusText(pendingCount, failedCount, isOnline);

  const invite = useInviteModal(list);
  const rename = useRenameList(list, onListsChanged);
  const deleteConfirm = useDeleteList(list, onListsChanged);
  const newList = useNewList(onListsChanged);
  const joinByCode = useJoinByCode(
    initialCode,
    onDeepLinkConsumed,
    onListsChanged,
  );

  return { deleteConfirm, invite, joinByCode, newList, rename, syncStatusText };
}
