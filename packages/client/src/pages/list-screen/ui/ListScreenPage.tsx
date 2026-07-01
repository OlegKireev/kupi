import type { Category, List } from '@kupi/shared';
import { ListScreen } from '@/widgets/list-screen';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
};

export function ListScreenPage({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
}: Props) {
  return (
    <ListScreen
      list={list}
      lists={lists}
      categories={categories}
      onSwitchList={onSwitchList}
      onListsChanged={onListsChanged}
    />
  );
}
