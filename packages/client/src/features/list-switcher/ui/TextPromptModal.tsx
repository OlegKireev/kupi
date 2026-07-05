import type { ReactNode } from 'react';

import { Button, Modal, TextInput } from '@/shared/ui';

interface Props {
  opened: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  placeholder?: string;
  submitIcon?: ReactNode;
}

/** Общая форма "модалка с одним текстовым полем" — переименование списка,
 * новый список и join-по-коду отличаются только текстами/иконкой. */
export function TextPromptModal({
  opened,
  onClose,
  title,
  value,
  onChange,
  onSubmit,
  submitLabel,
  placeholder,
  submitIcon,
}: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
    >
      <TextInput
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        data-autofocus
      />
      <Button
        mt="md"
        fullWidth
        leftSection={submitIcon}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </Modal>
  );
}
