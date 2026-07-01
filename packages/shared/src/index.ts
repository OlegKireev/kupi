import { z } from 'zod/v4';

export const AccountSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
});
export type Account = z.infer<typeof AccountSchema>;

export const DeviceSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  createdAt: z.number(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const ListRoleSchema = z.enum(['owner', 'member']);
export type ListRole = z.infer<typeof ListRoleSchema>;

export const ListSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerAccountId: z.string(),
  seq: z.number(),
  createdAt: z.number(),
});
export type List = z.infer<typeof ListSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  listId: z.string(),
  name: z.string(),
  quantity: z.number(),
  categoryId: z.string().nullable(),
  checked: z.boolean(),
  version: z.number(),
  deleted: z.boolean(),
  updatedAt: z.number(),
});
export type Item = z.infer<typeof ItemSchema>;

export const ItemChangeSchema = z.object({
  itemId: z.string(),
  clientOpId: z.string(),
  op: z.enum(['upsert', 'delete']),
  fields: z
    .object({
      name: z.string().optional(),
      quantity: z.number().optional(),
      categoryId: z.string().nullable().optional(),
      checked: z.boolean().optional(),
    })
    .default({}),
});
export type ItemChange = z.infer<typeof ItemChangeSchema>;

export const SyncRequestSchema = z.object({
  lastSeenSeq: z.number().int().min(0),
  changes: z.array(ItemChangeSchema),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export const SyncResponseSchema = z.object({
  seq: z.number(),
  items: z.array(ItemSchema),
});
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

export const BootstrapSchema = z.object({
  account: AccountSchema,
  lists: z.array(ListSchema),
  categories: z.array(CategorySchema),
});
export type Bootstrap = z.infer<typeof BootstrapSchema>;

export const SuggestionSchema = z.object({
  name: z.string(),
  count: z.number(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

// Валидаторы тела запроса, переиспользуемые серверными роутами.
export const CodeBodySchema = z.object({ code: z.string().min(1) });
export const NameBodySchema = z.object({ name: z.string().min(1) });
export const ListParamsSchema = z.object({ id: z.string().min(1) });
export const SuggestQuerySchema = z.object({ q: z.string().optional() });
