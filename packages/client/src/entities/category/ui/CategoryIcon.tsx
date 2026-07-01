import type { Category } from '@kupi/shared';
import styles from './styles.module.css';

type Props = { category: Category | undefined };

export function CategoryIcon({ category }: Props) {
  if (!category) {
    return null;
  }

  return (
    <span
      className={styles.categoryDot}
      style={{ backgroundColor: category.color }}
    />
  );
}
