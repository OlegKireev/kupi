import { ListScreenPage } from '@/pages/list-screen';
import { useAppLists } from './model/useAppLists';
import { useDeepLink } from './model/useDeepLink';

export function App() {
  const { clearDeepLink, deepLink } = useDeepLink();
  const {
    activeListId,
    categories,
    lists,
    onAccountLinked,
    refreshLists,
    setActiveListId,
  } = useAppLists();

  const activeList = lists.find(({ id }) => id === activeListId);
  if (!activeList) {
    return null;
  }

  return (
    <ListScreenPage
      key={activeList.id}
      list={activeList}
      lists={lists}
      categories={categories}
      onSwitchList={setActiveListId}
      onListsChanged={refreshLists}
      onAccountLinked={onAccountLinked}
      initialListCode={deepLink?.kind === 'list' ? deepLink.code : undefined}
      initialDeviceCode={
        deepLink?.kind === 'device' ? deepLink.code : undefined
      }
      onDeepLinkConsumed={clearDeepLink}
    />
  );
}
