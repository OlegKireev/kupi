import type { Category } from '@kupi/shared';

type Props = { category: Category | undefined };

export function CategoryIcon({ category }: Props) {
  if (!category) return null;
  return (
    <span className="category-icon">
      {category.icon}
      <span className="category-dot" style={{ backgroundColor: category.color }} />
    </span>
  );
}
