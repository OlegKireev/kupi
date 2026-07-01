import type { SyncResponse } from '@kupi/shared';
import { useAddItem } from '../model/useAddItem';

type Props = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse, pinItemId: string) => void;
};

export function AddItemInput({ listId, lastSeenSeq, onSynced }: Props) {
  const { text, suggestions, onTextChange, submit } = useAddItem({
    listId,
    lastSeenSeq,
    onSynced,
  });

  return (
    <div className="add-item">
      <input
        className="add-item__input"
        value={text}
        placeholder="Добавить товар"
        onChange={(e) => void onTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
      />
      {suggestions.length > 0 && (
        <ul className="add-item__suggestions">
          {suggestions.map((s) => (
            <li
              key={s.name}
              className="add-item__suggestion"
              onClick={() => void onTextChange(s.name)}
            >
              {s.name} ({s.count})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
