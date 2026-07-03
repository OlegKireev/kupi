import type { Bootstrap } from '@kupi/shared';

import {
  ActionIcon,
  Button,
  Menu,
  Modal,
  Text,
  TextInput,
  CopyIcon,
  DevicesIcon,
  KeyIcon,
  QrCodeIcon,
  UserCircleIcon,
} from '@/shared/ui';
import { useAccountMenu } from '../model/useAccountMenu';

type Props = {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
};

export function AccountMenu({ onAccountLinked }: Props) {
  const {
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
  } = useAccountMenu({ onAccountLinked });

  return (
    <>
      <Menu>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            aria-label="Меню аккаунта"
          >
            <UserCircleIcon size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<DevicesIcon size={16} />}
            onClick={openLinkDevice}
          >
            Подключить это устройство
          </Menu.Item>
          <Menu.Item
            leftSection={<KeyIcon size={16} />}
            onClick={openDeviceCode}
          >
            Ввести код устройства
          </Menu.Item>
          <Menu.Item
            disabled
            leftSection={<QrCodeIcon size={16} />}
          >
            QR-код (скоро)
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={codeModal !== null}
        onClose={closeCodeModal}
        title={codeModal?.title}
      >
        <Text
          size="xl"
          fw={700}
          ta="center"
        >
          {codeModal?.code}
        </Text>
        <Button
          mt="md"
          fullWidth
          leftSection={<CopyIcon size={16} />}
          onClick={() => navigator.clipboard.writeText(codeModal?.code ?? '')}
        >
          Копировать
        </Button>
      </Modal>

      <Modal
        opened={deviceCodeOpen}
        onClose={closeDeviceCode}
        title="Ввести код устройства"
      >
        <TextInput
          value={deviceCodeValue}
          onChange={(e) => setDeviceCodeValue(e.currentTarget.value)}
          placeholder="Код подключения устройства"
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          leftSection={<KeyIcon size={16} />}
          onClick={submitDeviceCode}
        >
          Продолжить
        </Button>
      </Modal>

      <Modal
        opened={pendingLinkCode !== null}
        onClose={cancelLinkDevice}
        title="Подключить устройство?"
      >
        <Text>
          Это заменит аккаунт этого устройства. Текущие списки станут
          недоступны с него. Продолжить?
        </Text>
        <Button
          mt="md"
          fullWidth
          color="red"
          onClick={confirmLinkDevice}
        >
          Подключить
        </Button>
      </Modal>
    </>
  );
}
