import { Chip, Group } from '@/shared/ui';
import type { Category } from '@kupi/shared';

interface CategoryChipsProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onChange: (value: string) => void;
  onChipClick: (event: React.MouseEvent<HTMLInputElement, MouseEvent>) => void;
}

export function CategoryChips({
  categories,
  selectedCategoryId,
  onChange,
  onChipClick,
}: CategoryChipsProps) {
  return (
    <Chip.Group
      multiple={false}
      value={selectedCategoryId}
      onChange={onChange}
    >
      <Group gap="xs">
        {categories.map(({ id, name, icon }) => (
          <Chip
            key={id}
            value={id}
            onClick={onChipClick}
          >
            {icon} {name}
          </Chip>
        ))}
      </Group>
    </Chip.Group>
  );
}
