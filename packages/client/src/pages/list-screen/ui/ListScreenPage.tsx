import type { Category, List } from '@kupi/shared';
import { ListScreen } from '@/widgets/list-screen';

type Props = { list: List; categories: Category[] };

export function ListScreenPage({ list, categories }: Props) {
  return <ListScreen list={list} categories={categories} />;
}
