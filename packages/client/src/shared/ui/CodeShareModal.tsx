import { useEffect, useState } from 'react';
import { Button, Modal, Text } from '@mantine/core';
import { CopyIcon, ShareIcon } from '@phosphor-icons/react';
import QRCode from 'qrcode';

type Props = {
  opened: boolean;
  onClose: () => void;
  title: string;
  url: string;
  code: string;
};

/**
 * Общая модалка для обеих генерирующих сторон шеринга (инвайт в список,
 * линковка устройства) — QR сверху, код текстом снизу, «Копировать»
 * (копирует полную ссылку, не голый код) и «Поделиться» (если у браузера
 * есть Web Share API).
 */
export function CodeShareModal({ opened, onClose, title, url, code }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setQrDataUrl(null);
    let cancelled = false;
    void QRCode.toDataURL(url).then((dataUrl) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [opened, url]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
    >
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR-код"
          width={200}
          height={200}
          style={{ display: 'block', margin: '0 auto 16px' }}
        />
      )}
      <Text
        size="xl"
        fw={700}
        ta="center"
      >
        {code}
      </Text>
      <Button
        mt="md"
        fullWidth
        leftSection={<CopyIcon size={16} />}
        onClick={() => navigator.clipboard.writeText(url)}
      >
        Копировать
      </Button>
      {typeof navigator.share === 'function' && (
        <Button
          mt="sm"
          fullWidth
          variant="light"
          leftSection={<ShareIcon size={16} />}
          onClick={() => navigator.share({ url })}
        >
          Поделиться
        </Button>
      )}
    </Modal>
  );
}
