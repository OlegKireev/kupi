import { useRef, useState } from 'react';

import type { ItemChange, Suggestion } from '@kupi/shared';

import { generateId } from '@/shared/lib/ids';
import { getSuggestions } from '../api/suggestions-api';

type Params = {
  applyChange: (change: ItemChange) => void;
};

export function useAddItem({ applyChange }: Params) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const latestQueryRef = useRef('');
  // Mantine's Autocomplete fires onOptionSubmit and a controlled
  // onChange(label) echo for the same selection (mouse or keyboard). This
  // flag lets addItem's caller suppress that echo and a racing Enter-submit
  // triggered before Mantine registers the selection - see AddItemInput.
  const justSelectedRef = useRef(false);

  const onTextChange = async (value: string): Promise<void> => {
    if (justSelectedRef.current) {
      return;
    }
    setText(value);
    latestQueryRef.current = value;
    const results = value.trim() ? await getSuggestions(value) : [];
    if (latestQueryRef.current === value) {
      setSuggestions(results);
    }
  };

  const addItem = (name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    applyChange({
      itemId: generateId(),
      clientOpId: generateId(),
      op: 'upsert',
      fields: { name: trimmed, quantity: 1, categoryId: null },
    });
    setText('');
    setSuggestions([]);
  };

  const submit = (): void => addItem(text);

  const selectSuggestion = (name: string): void => {
    justSelectedRef.current = true;
    queueMicrotask(() => {
      justSelectedRef.current = false;
    });
    addItem(name);
  };

  const submitOnEnter = (): void => {
    queueMicrotask(() => {
      if (justSelectedRef.current) {
        return;
      }
      submit();
    });
  };

  return { text, suggestions, onTextChange, submitOnEnter, selectSuggestion };
}
