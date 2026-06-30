export interface Account {
  id: string;
  createdAt: number;
}

export interface Device {
  id: string;
  accountId: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type ListRole = "owner" | "member";

export interface List {
  id: string;
  name: string;
  ownerAccountId: string;
  seq: number;
  createdAt: number;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  categoryId: string | null;
  checked: boolean;
  version: number;
  deleted: boolean;
  updatedAt: number;
}
