import { useEffect, useRef, useState } from 'react';

import type { Bootstrap } from '@kupi/shared';

import { redeemLinkCode } from '@/entities/list';
import { handleInvalidCodeError } from '@/shared/api';
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

/** Состояние экрана ручного ввода кода устройства — вынесено отдельно,
 * чтобы useAccountMenu укладывался в max-statements. */
function useDeviceCodeInput(onSubmit: (code: string) => void) {
  const [deviceCodeOpen, setDeviceCodeOpen] = useState(false);
  const [deviceCodeValue, setDeviceCodeValue] = useState('');

  const openDeviceCode = (): void => {
    setDeviceCodeValue('');
    setDeviceCodeOpen(true);
  };
  const closeDeviceCode = (): void => setDeviceCodeOpen(false);
  // Возврат к экрану ввода из предупреждающей модалки (cancelLinkDevice) —
  // в отличие от openDeviceCode, не должен сбрасывать уже введённый код.
  const reopenDeviceCode = (): void => setDeviceCodeOpen(true);
  const submitDeviceCode = (): void => {
    onSubmit(deviceCodeValue);
    setDeviceCodeOpen(false);
  };

  return {
    closeDeviceCode,
    deviceCodeOpen,
    deviceCodeValue,
    openDeviceCode,
    reopenDeviceCode,
    setDeviceCodeValue,
    submitDeviceCode,
  };
}

export function useAccountMenu({
  onAccountLinked,
  initialCode,
  onDeepLinkConsumed,
}: Params) {
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);
  const deviceCode = useDeviceCodeInput(setPendingLinkCode);

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

  const cancelLinkDevice = (): void => {
    setPendingLinkCode(null);
    deviceCode.reopenDeviceCode();
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
      handleInvalidCodeError(err, () => {
        setPendingLinkCode(null);
        deviceCode.reopenDeviceCode();
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
      });
    }
  };

  return {
    cancelLinkDevice,
    closeCodeModal,
    codeModal,
    confirmLinkDevice,
    openLinkDevice,
    pendingLinkCode,
    ...deviceCode,
  };
}
