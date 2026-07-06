import type { List } from '@kupi/shared';

import {
  CheckIcon,
  FilePlusIcon,
  KeyIcon,
  Menu,
  TextboxIcon,
  TrashIcon,
  UserPlusIcon,
  UsersFourIcon,
} from '@/shared/ui';
import { MenuTrigger } from './MenuTrigger';

interface Props {
  list: List;
  lists: List[];
  isOwner: boolean;
  syncStatusText: string;
  memberCount: number | null;
  onOpen: () => void;
  onSwitchList: (id: string) => void;
  onInvite: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewList: () => void;
  onJoinByCode: () => void;
}

export function ListMenu({
  list,
  lists,
  isOwner,
  syncStatusText,
  memberCount,
  onOpen,
  onSwitchList,
  onInvite,
  onRename,
  onDelete,
  onNewList,
  onJoinByCode,
}: Props) {
  return (
    <Menu onOpen={onOpen}>
      <Menu.Target>
        <MenuTrigger>{list.name}</MenuTrigger>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{syncStatusText}</Menu.Label>
        {isOwner && (
          <Menu.Item
            leftSection={<UserPlusIcon size={16} />}
            onClick={onInvite}
          >
            Пригласить в список
          </Menu.Item>
        )}
        <Menu.Label>Участники ({memberCount ?? '…'})</Menu.Label>
        {isOwner && (
          <Menu.Item
            leftSection={<TextboxIcon size={16} />}
            onClick={onRename}
          >
            Переименовать список
          </Menu.Item>
        )}
        <Menu.Item
          color="red"
          leftSection={<TrashIcon size={16} />}
          onClick={onDelete}
        >
          {isOwner ? 'Удалить список' : 'Покинуть список'}
        </Menu.Item>
        <Menu.Divider />
        {lists.map(({ id, role, name }) => (
          <Menu.Item
            key={id}
            leftSection={
              role === 'member' ? <UsersFourIcon size={14} /> : undefined
            }
            rightSection={id === list.id ? <CheckIcon size={16} /> : null}
            onClick={() => onSwitchList(id)}
          >
            {name}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item
          leftSection={<FilePlusIcon size={16} />}
          onClick={onNewList}
        >
          Новый список
        </Menu.Item>
        <Menu.Item
          leftSection={<KeyIcon size={16} />}
          onClick={onJoinByCode}
        >
          Присоединиться по коду списка
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
