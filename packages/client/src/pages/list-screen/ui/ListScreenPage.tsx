import type { Bootstrap, Category, List } from '@kupi/shared';

import { ListScreen } from '@/widgets/list-screen';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialListCode?: string;
  initialDeviceCode?: string;
  onDeepLinkConsumed: () => void;
};

export function ListScreenPage({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
  initialListCode,
  initialDeviceCode,
  onDeepLinkConsumed,
}: Props) {
  return (
    <ListScreen
      list={list}
      lists={lists}
      categories={categories}
      onSwitchList={onSwitchList}
      onListsChanged={onListsChanged}
      onAccountLinked={onAccountLinked}
      initialListCode={initialListCode}
      initialDeviceCode={initialDeviceCode}
      onDeepLinkConsumed={onDeepLinkConsumed}
    />
  );
}
