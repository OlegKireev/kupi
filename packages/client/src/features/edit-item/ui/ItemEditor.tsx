import type { Category, Item, SyncResponse } from '@kupi/shared';
import { CategoryIcon } from '@/entities/category';
import { useEditItem } from '../model/useEditItem';

type Props = {
  item: Item;
  categories: Category[];
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse) => void;
  onClose: () => void;
};

export function ItemEditor({
  item,
  categories,
  listId,
  lastSeenSeq,
  onSynced,
  onClose,
}: Props) {
  const { setQuantity, setCategory, deleteItem } = useEditItem({
    listId,
    lastSeenSeq,
    onSynced,
  });
  const category = categories.find((c) => c.id === item.categoryId);

  return (
    <li className="item-row item-row--expanded">
      <div className="item-editor__header" onClick={onClose}>
        <span className="item-row__name">{item.name}</span>
        <CategoryIcon category={category} />
      </div>
      <div className="item-editor__quantity">
        <button
          type="button"
          onClick={() => void setQuantity(item, Math.max(1, item.quantity - 1))}
        >
          −
        </button>
        <span>{item.quantity}</span>
        <button type="button" onClick={() => void setQuantity(item, item.quantity + 1)}>
          +
        </button>
      </div>
      <div className="item-editor__categories">
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`category-chip${c.id === item.categoryId ? ' category-chip--active' : ''}`}
            onClick={() => void setCategory(item, c.id)}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="item-editor__delete"
        onClick={() => {
          void deleteItem(item);
          onClose();
        }}
      >
        Удалить товар
      </button>
    </li>
  );
}
