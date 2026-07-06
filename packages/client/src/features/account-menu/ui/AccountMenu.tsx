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
  TextPromptModal,
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
    isDeviceCodeOpen,
    deviceCodeValue,
    setDeviceCodeValue,
    openDeviceCode,
    closeDeviceCode,
    submitDeviceCode,
    pendingLinkCode,
    cancelLinkDevice,
    confirmLinkDevice,
    isLinking,
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

      <TextPromptModal
        opened={isDeviceCodeOpen}
        onClose={closeDeviceCode}
        title="Ввести код устройства"
        value={deviceCodeValue}
        onChange={setDeviceCodeValue}
        onSubmit={submitDeviceCode}
        placeholder="Код подключения устройства"
        submitLabel="Продолжить"
        submitIcon={<KeyIcon size={16} />}
      />

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
          loading={isLinking}
          onClick={confirmLinkDevice}
        >
          Подключить
        </Button>
      </Modal>
    </>
  );
}
