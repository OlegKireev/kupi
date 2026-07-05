import { useEffect, useRef, useState } from 'react';

import type { Bootstrap } from '@kupi/shared';

import { redeemLinkCode } from '@/entities/list';
import { ApiError } from '@/shared/api';
import { buildDeepLink } from '@/shared/lib/deep-link';
import { notifications } from '@/shared/ui';
import { createLinkCode } from '../api/link-code-api';

interface Params {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
}

type CodeModalState = { title: string; code: string; url: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useAccountMenu({
  onAccountLinked,
  initialCode,
  onDeepLinkConsumed,
}: Params) {
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [deviceCodeOpen, setDeviceCodeOpen] = useState(false);
  const [deviceCodeValue, setDeviceCodeValue] = useState('');
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);

  // Диплинк (?deviceCode=...) пропускает шаг ручного ввода и сразу
  // открывает предупреждающую модалку — та же логика, что и после
  // submitDeviceCode(), просто код известен заранее.
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || !initialCode) {
      return;
    }
    deepLinkConsumed.current = true;
    setPendingLinkCode(initialCode);
    onDeepLinkConsumed();
  }, [initialCode, onDeepLinkConsumed]);

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({
      code,
      title: 'Код подключения устройства',
      url: buildDeepLink('device', code),
    });
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
    cancelLinkDevice,
    closeCodeModal,
    closeDeviceCode,
    codeModal,
    confirmLinkDevice,
    deviceCodeOpen,
    deviceCodeValue,
    openDeviceCode,
    openLinkDevice,
    pendingLinkCode,
    setDeviceCodeValue,
    submitDeviceCode,
  };
}
