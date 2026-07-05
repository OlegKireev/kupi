import type { Bootstrap } from '@kupi/shared';

import {
  ActionIcon,
  Button,
  CodeShareModal,
  DevicesIcon,
  KeyIcon,
  Menu,
  Modal,
  Text,
  TextInput,
  UserCircleIcon,
} from '@/shared/ui';
import { useAccountMenu } from '../model/useAccountMenu';

interface Props {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
}

export function AccountMenu({
  onAccountLinked,
  initialCode,
  onDeepLinkConsumed,
}: Props) {
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
  } = useAccountMenu({ initialCode, onAccountLinked, onDeepLinkConsumed });

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
        </Menu.Dropdown>
      </Menu>

      <CodeShareModal
        opened={codeModal !== null}
        onClose={closeCodeModal}
        title={codeModal?.title ?? ''}
        url={codeModal?.url ?? ''}
        code={codeModal?.code ?? ''}
      />

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
          Это заменит аккаунт этого устройства. Текущие списки станут недоступны
          с него. Продолжить?
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
