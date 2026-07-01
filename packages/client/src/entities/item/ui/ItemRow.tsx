import type { ReactNode } from 'react';
import type { Item } from '@kupi/shared';

type Props = {
  item: Item;
  categoryIcon?: ReactNode;
  onToggle: () => void;
  onOpen: () => void;
};

export function ItemRow({ item, categoryIcon, onToggle, onOpen }: Props) {
  return (
    <li className={`item-row${item.checked ? ' item-row--checked' : ''}`}>
      <input type="checkbox" checked={item.checked} onChange={onToggle} />
      <span className="item-row__name" onClick={onOpen}>
        {item.name}
      </span>
      {categoryIcon}
    </li>
  );
}
