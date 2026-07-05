import type { ComponentPropsWithRef, ReactNode } from 'react';

import { CaretDownIcon, Group, Title, UnstyledButton } from '@/shared/ui';
import styles from './styles.module.css';

interface Props extends ComponentPropsWithRef<'button'> {
  children: ReactNode;
}

// ...props (incl. ref, React 19 passes it as a plain prop) forwards
// Menu.Target's injected onClick/aria-*/ref onto the real button — Menu.Target
// clones its child and relies on that being forwarded, same as a plain
// UnstyledButton would do natively.
export function MenuTrigger({ children, ...props }: Props) {
  return (
    <UnstyledButton
      className={styles.menuTrigger}
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
