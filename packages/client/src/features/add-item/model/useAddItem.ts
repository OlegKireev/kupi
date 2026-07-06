import { useDebouncedCallback } from '@mantine/hooks';
import { useRef, useState } from 'react';

import type { ItemChange, Suggestion } from '@kupi/shared';

import { generateId } from '@/shared/lib/ids';
import { getSuggestions } from '../api/suggestions-api';

interface Params {
  applyChange: (change: ItemChange) => void;
}

const SUGGESTIONS_DEBOUNCE_MS = 250;

export function useAddItem({ applyChange }: Params) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const latestQueryRef = useRef('');
  // Mantine's Autocomplete fires onOptionSubmit and a controlled
  // onChange(label) echo for the same selection (mouse or keyboard). This
  // flag lets addItem's caller suppress that echo and a racing Enter-submit
  // triggered before Mantine registers the selection - see AddItemInput.
  const justSelectedRef = useRef(false);

  const fetchSuggestions = useDebouncedCallback(async (value: string) => {
    try {
      const results = value.trim() ? await getSuggestions(value) : [];
      if (latestQueryRef.current === value) {
        setSuggestions(results);
      }
    } catch {
      // Подсказки — best-effort: сетевую ошибку глотаем молча, а не показываем
      // пользователю глобальный тост просто за то, что он печатает.
    }
  }, SUGGESTIONS_DEBOUNCE_MS);

  const onTextChange = (value: string): void => {
    if (justSelectedRef.current) {
      return;
    }
    setText(value);
    latestQueryRef.current = value;
    fetchSuggestions(value);
  };

  const addItem = (name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    applyChange({
      clientOpId: generateId(),
      fields: { categoryId: null, name: trimmed, quantity: 1 },
      itemId: generateId(),
      op: 'upsert',
    });
    setText('');
    setSuggestions([]);
  };

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
      addItem(text);
    });
  };

  return { onTextChange, selectSuggestion, submitOnEnter, suggestions, text };
}
