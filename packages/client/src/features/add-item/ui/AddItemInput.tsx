import { useMemo } from 'react';

import type { ItemChange } from '@kupi/shared';

import { Autocomplete } from '@/shared/ui';
import { useAddItem } from '../model/useAddItem';

interface Props {
  applyChange: (change: ItemChange) => void;
}

export function AddItemInput({ applyChange }: Props) {
  const { text, suggestions, onTextChange, submitOnEnter, selectSuggestion } =
    useAddItem({ applyChange });
  const data = useMemo(
    () => suggestions.map(({ name }) => ({ label: name, value: name })),
    [suggestions],
  );

  return (
    <Autocomplete
      value={text}
      placeholder="Добавить товар"
      data={data}
      renderOption={({ option }) => {
        const count = suggestions.find(
          ({ name }) => name === option.value,
        )?.count;
        return `${option.value} (${count})`;
      }}
      onChange={onTextChange}
      onOptionSubmit={selectSuggestion}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          submitOnEnter();
        }
      }}
    />
  );
}
