import { Button, Modal, Text } from '@/shared/ui';

interface Props {
  opened: boolean;
  onClose: () => void;
  isOwner: boolean;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteConfirmModal({
  opened,
  onClose,
  isOwner,
  onConfirm,
  loading,
}: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isOwner ? 'Удалить список?' : 'Покинуть список?'}
    >
      <Text>
        {isOwner
          ? 'Список удалится для всех участников.'
          : 'Вы выйдете из списка, для остальных участников он останется.'}
      </Text>
      <Button
        mt="md"
        fullWidth
        color="red"
        loading={loading}
        onClick={onConfirm}
      >
        Подтвердить
      </Button>
    </Modal>
  );
}
