import type { SyncResponse } from '@kupi/shared';
import { Autocomplete } from '@/shared/ui';
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
    <Autocomplete
      value={text}
      placeholder="Добавить товар"
      data={suggestions.map((s) => ({
        value: s.name,
        label: `${s.name} (${s.count})`,
      }))}
      onChange={(value) => void onTextChange(value)}
      onOptionSubmit={(value) => void onTextChange(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void submit();
      }}
    />
  );
}
