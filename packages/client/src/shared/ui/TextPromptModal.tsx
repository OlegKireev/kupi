import { Button, Modal, TextInput } from '@mantine/core';
import type { ReactNode } from 'react';

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
  loading?: boolean;
}

/** Общая форма «модалка с одним текстовым полем» — переименование/новый
 * список, join по коду списка, ввод кода устройства отличаются только
 * текстами и иконкой. Обёрнута в <form>, чтобы Enter сабмитил, а не только
 * клик по кнопке. */
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
  loading,
}: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <TextInput
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={placeholder}
          data-autofocus
        />
        <Button
          type="submit"
          mt="md"
          fullWidth
          leftSection={submitIcon}
          loading={loading}
        >
          {submitLabel}
        </Button>
      </form>
    </Modal>
  );
}
