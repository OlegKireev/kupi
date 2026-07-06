import { ListScreenPage } from '@/pages/list-screen';
import { Button, Center, Loader, Stack, Text } from '@/shared/ui';
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
    retry,
    setActiveListId,
    status,
  } = useAppLists();

  if (status === 'loading') {
    return (
      <Center h="100dvh">
        <Loader />
      </Center>
    );
  }

  if (status === 'error') {
    return (
      <Center h="100dvh">
        <Stack align="center">
          <Text c="dimmed">Не удалось загрузить списки</Text>
          <Button onClick={retry}>Повторить</Button>
        </Stack>
      </Center>
    );
  }

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
