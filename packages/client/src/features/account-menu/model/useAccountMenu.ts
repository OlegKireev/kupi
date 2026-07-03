import { useState } from 'react';

import type { Bootstrap } from '@kupi/shared';

import { redeemLinkCode } from '@/entities/list';
import { ApiError } from '@/shared/api';
import { notifications } from '@/shared/ui';
import { createLinkCode } from '../api/link-code-api';

type Params = {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
};

type CodeModalState = { title: string; code: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useAccountMenu({ onAccountLinked }: Params) {
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [deviceCodeOpen, setDeviceCodeOpen] = useState(false);
  const [deviceCodeValue, setDeviceCodeValue] = useState('');
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({ title: 'Код подключения устройства', code });
  };

  const closeCodeModal = (): void => setCodeModal(null);

  const openDeviceCode = (): void => {
    setDeviceCodeValue('');
    setDeviceCodeOpen(true);
  };
  const closeDeviceCode = (): void => setDeviceCodeOpen(false);

  const submitDeviceCode = (): void => {
    setPendingLinkCode(deviceCodeValue);
    setDeviceCodeOpen(false);
  };

  const cancelLinkDevice = (): void => {
    setPendingLinkCode(null);
    setDeviceCodeOpen(true);
  };

  const confirmLinkDevice = async (): Promise<void> => {
    const code = pendingLinkCode;
    if (!code) {
      return;
    }
    try {
      const bootstrap = await redeemLinkCode(code);
      setPendingLinkCode(null);
      await onAccountLinked(bootstrap);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setPendingLinkCode(null);
        setDeviceCodeOpen(true);
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
        return;
      }
      throw err;
    }
  };

  return {
    codeModal,
    closeCodeModal,
    openLinkDevice,
    deviceCodeOpen,
    deviceCodeValue,
    setDeviceCodeValue,
    openDeviceCode,
    closeDeviceCode,
    submitDeviceCode,
    pendingLinkCode,
    cancelLinkDevice,
    confirmLinkDevice,
  };
}
