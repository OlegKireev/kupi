import type { ItemChange } from '@kupi/shared';
import { Autocomplete } from '@/shared/ui';
import { useAddItem } from '../model/useAddItem';

type Props = {
  applyChange: (change: ItemChange) => void;
};

export function AddItemInput({ applyChange }: Props) {
  const { text, suggestions, onTextChange, submitOnEnter, selectSuggestion } =
    useAddItem({ applyChange });

  return (
    <Autocomplete
      value={text}
      placeholder="Добавить товар"
      data={suggestions.map((s) => ({ value: s.name, label: s.name }))}
      renderOption={({ option }) => {
        const count = suggestions.find((s) => s.name === option.value)?.count;
        return `${option.value} (${count})`;
      }}
      onChange={onTextChange}
      onOptionSubmit={selectSuggestion}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submitOnEnter();
      }}
    />
  );
}
