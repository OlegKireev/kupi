import type { ComponentPropsWithRef, ReactNode } from 'react';

import { CaretDownIcon, Group, Title, UnstyledButton } from '@/shared/ui';
import styles from './styles.module.css';

interface Props extends ComponentPropsWithRef<'button'> {
  children: ReactNode;
}

export function MenuTrigger({ children, className, ...props }: Props) {
  return (
    <UnstyledButton
      className={[className, styles.menuTrigger].filter(Boolean).join(' ')}
      {...props}
    >
      <Group
        gap={8}
        wrap="nowrap"
      >
        <Title
          order={1}
          size="h2"
        >
          {children}
        </Title>
        <CaretDownIcon
          size={20}
          className={styles.caretIcon}
        />
      </Group>
    </UnstyledButton>
  );
}
