import { useState } from 'react';

import type { List } from '@kupi/shared';

import {
  createInvite,
  deleteList,
  getMemberCount,
  renameList,
} from '@/entities/list';
import { createLinkCode } from '../api/link-code-api';

type Params = {
  list: List;
  onListsChanged: (selectId?: string) => void;
};

type CodeModalState = { title: string; code: string } | null;

export function useListMenu({ list, onListsChanged }: Params) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadMemberCount = (): void => {
    void getMemberCount(list.id).then(setMemberCount);
  };

  const openInvite = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setCodeModal({ title: 'Код приглашения', code });
  };

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({ title: 'Код подключения устройства', code });
  };

  const closeCodeModal = (): void => setCodeModal(null);

  const openRename = (): void => {
    setRenameValue(list.name);
    setRenameOpen(true);
  };

  const closeRename = (): void => setRenameOpen(false);

  const submitRename = async (): Promise<void> => {
    const name = renameValue.trim();
    if (!name) return;
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

  return {
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
  };
}
