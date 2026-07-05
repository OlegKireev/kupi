import { CaretDownIcon, Group, Title, UnstyledButton } from '@/shared/ui';
import styles from './styles.module.css';

export function MenuTrigger({ children }: { children: React.ReactNode }) {
  return (
    <UnstyledButton className={styles.menuTrigger}>
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
