import { useEffect, useRef, useState } from 'react';

import type { Bootstrap } from '@kupi/shared';

import { redeemLinkCode } from '@/entities/list';
import { handleInvalidCodeError } from '@/shared/api';
import { buildDeepLink } from '@/shared/lib/deep-link';
import { notifyInvalidCode } from '@/shared/lib/notify';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import type { CodeShareModalState } from '@/shared/ui';
import { createLinkCode } from '../api/link-code-api';

interface Params {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
}

/** Состояние экрана ручного ввода кода устройства — вынесено отдельно,
 * чтобы useAccountMenu укладывался в max-statements. */
function useDeviceCodeInput(onSubmit: (code: string) => void) {
  const [isDeviceCodeOpen, setIsDeviceCodeOpen] = useState(false);
  const [deviceCodeValue, setDeviceCodeValue] = useState('');

  const openDeviceCode = (): void => {
    setDeviceCodeValue('');
    setIsDeviceCodeOpen(true);
  };
  const closeDeviceCode = (): void => setIsDeviceCodeOpen(false);
  // Возврат к экрану ввода из предупреждающей модалки (cancelLinkDevice) —
  // в отличие от openDeviceCode, не должен сбрасывать уже введённый код.
  const reopenDeviceCode = (): void => setIsDeviceCodeOpen(true);
  const submitDeviceCode = (): void => {
    // Пустой код не открывает предупреждающую модалку с мёртвой кнопкой
    // «Подключить»
    const code = deviceCodeValue.trim();
    if (!code) {
      return;
    }
    onSubmit(code);
    setIsDeviceCodeOpen(false);
  };

  return {
    closeDeviceCode,
    deviceCodeValue,
    isDeviceCodeOpen,
    openDeviceCode,
    reopenDeviceCode,
    setDeviceCodeValue,
    submitDeviceCode,
  };
}

function useLinkCodeModal() {
  const [codeModal, setCodeModal] = useState<CodeShareModalState | null>(null);

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({
      code,
      title: 'Код подключения устройства',
      url: buildDeepLink('device', code),
    });
  };

  const closeCodeModal = (): void => setCodeModal(null);

  return { closeCodeModal, codeModal, openLinkDevice };
}

export function useAccountMenu({
  onAccountLinked,
  initialCode,
  onDeepLinkConsumed,
}: Params) {
  const linkCode = useLinkCodeModal();
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);
  const deviceCode = useDeviceCodeInput(setPendingLinkCode);

  // Диплинк (?deviceCode=...) пропускает шаг ручного ввода и сразу
  // открывает предупреждающую модалку — та же логика, что и после
  // submitDeviceCode(), просто код известен заранее.
  const hasConsumedDeepLink = useRef(false);
  useEffect(() => {
    if (hasConsumedDeepLink.current || !initialCode) {
      return;
    }
    hasConsumedDeepLink.current = true;
    setPendingLinkCode(initialCode);
    onDeepLinkConsumed();
  }, [initialCode, onDeepLinkConsumed]);

  const cancelLinkDevice = (): void => {
    setPendingLinkCode(null);
    deviceCode.reopenDeviceCode();
  };

  const submitConfirm = async (): Promise<void> => {
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
        notifyInvalidCode();
      });
    }
  };
  const { run: confirmLinkDevice, isLoading: isLinking } =
    useAsyncAction(submitConfirm);

  return {
    cancelLinkDevice,
    confirmLinkDevice,
    isLinking,
    pendingLinkCode,
    ...linkCode,
    ...deviceCode,
  };
}
