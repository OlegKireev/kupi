import { useState } from 'react';

import type { Bootstrap, List } from '@kupi/shared';

import { createList, joinList, redeemLinkCode } from '@/entities/list';
import { ApiError } from '@/shared/api';
import { notifications } from '@/shared/ui';
import { codeKind } from './code-kind';

type Params = {
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => void;
};

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useListSwitcher({ onListsChanged, onAccountLinked }: Params) {
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);

  const openNewList = (): void => setNewListOpen(true);
  const closeNewList = (): void => setNewListOpen(false);

  const submitNewList = async (): Promise<void> => {
    const name = newListName.trim();
    if (!name) return;
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
    const kind = codeKind(codeValue);

    if (kind === 'invalid') {
      notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
      return;
    }

    if (kind === 'device') {
      setPendingLinkCode(codeValue);
      setCodeOpen(false);
      return;
    }

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

  const cancelLinkDevice = (): void => {
    setPendingLinkCode(null);
    setCodeOpen(true);
  };

  const confirmLinkDevice = async (): Promise<void> => {
    const code = pendingLinkCode;
    if (!code) return;
    try {
      const bootstrap = await redeemLinkCode(code);
      setPendingLinkCode(null);
      onAccountLinked(bootstrap);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setPendingLinkCode(null);
        setCodeOpen(true);
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
        return;
      }
      throw err;
    }
  };

  return {
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
  };
}
