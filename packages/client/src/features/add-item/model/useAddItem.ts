import { useState } from 'react';
import type { Suggestion, SyncResponse } from '@kupi/shared';
import { syncItems } from '@/entities/item';
import { generateId } from '@/shared/lib/ids';
import { getSuggestions } from '../api/suggestions-api';

type Params = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse, pinItemId: string) => void;
};

export function useAddItem({ listId, lastSeenSeq, onSynced }: Params) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const onTextChange = async (value: string): Promise<void> => {
    setText(value);
    setSuggestions(value.trim() ? await getSuggestions(value) : []);
  };

  const submit = async (): Promise<void> => {
    const name = text.trim();
    if (!name) return;
    const itemId = generateId();
    const response = await syncItems(listId, {
      lastSeenSeq,
      changes: [
        {
          itemId,
          clientOpId: generateId(),
          op: 'upsert',
          fields: { name, quantity: 1, categoryId: null },
        },
      ],
    });
    onSynced(response, itemId);
    setText('');
    setSuggestions([]);
  };

  return { text, suggestions, onTextChange, submit };
}
