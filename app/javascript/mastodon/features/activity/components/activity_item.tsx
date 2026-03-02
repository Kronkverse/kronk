import type { List as ImmutableList, Map as ImmutableMap } from 'immutable';

import { Avatar } from 'mastodon/components/avatar';
import StatusContainer from 'mastodon/containers/status_container';
import type { Account } from 'mastodon/models/account';
import { useAppSelector } from 'mastodon/store';

interface ActivityItemProps {
  statusId: string;
  interactions: ImmutableList<ImmutableMap<string, string>>;
}

interface AccountRecord {
  get: (key: string) => string;
  toJS: () => Record<string, unknown>;
}

const interactionLabel = (type: string): string => {
  switch (type) {
    case 'favourite':
      return 'frothed';
    case 'boost':
      return 'boosted';
    case 'reply':
      return 'replied to';
    default:
      return type;
  }
};

const interactionEmoji = (type: string): string => {
  switch (type) {
    case 'favourite':
      return '\u2764\uFE0F';
    case 'boost':
      return '\uD83D\uDD01';
    case 'reply':
      return '\uD83D\uDCAC';
    default:
      return '';
  }
};

const ActivityItem: React.FC<ActivityItemProps> = ({
  statusId,
  interactions,
}) => {
  // Group interactions by type
  const grouped: Record<string, string[]> = {};
  interactions.forEach((interaction) => {
    const type = interaction.get('type') ?? '';
    const accountId = interaction.get('accountId') ?? '';
    grouped[type] ??= [];
    if (!grouped[type].includes(accountId)) grouped[type].push(accountId);
  });

  return (
    <div className='friends-activity-item'>
      <InteractionBar grouped={grouped} />
      {/* @ts-expect-error StatusContainer is untyped JSX */}
      <StatusContainer id={statusId} contextType='friends_activity' />
    </div>
  );
};

const InteractionBar: React.FC<{ grouped: Record<string, string[]> }> = ({
  grouped,
}) => {
  return (
    <div className='friends-activity-item__interaction-bar'>
      {Object.entries(grouped).map(([type, accountIds]) => (
        <InteractionGroup key={type} type={type} accountIds={accountIds} />
      ))}
    </div>
  );
};

const InteractionGroup: React.FC<{ type: string; accountIds: string[] }> = ({
  type,
  accountIds,
}) => {
  const accounts = useAppSelector((state) => {
    return accountIds
      .map((id) => state.accounts.get(id))
      .filter(Boolean) as AccountRecord[];
  });

  if (accounts.length === 0) return null;

  const names: string[] = accounts
    .map((a) => a.get('display_name') || a.get('username'))
    .filter(Boolean);

  let nameStr: string;
  if (names.length === 1) {
    nameStr = names.at(0) ?? '';
  } else if (names.length === 2) {
    nameStr = `${names[0]} and ${names[1]}`;
  } else {
    nameStr = `${names[0]} and ${names.length - 1} others`;
  }

  return (
    <div className='friends-activity-item__interaction-group'>
      <span className='friends-activity-item__avatars'>
        {accounts.slice(0, 3).map((account) => (
          <span
            key={account.get('id')}
            className='friends-activity-item__avatar'
          >
            <Avatar
              account={
                account.toJS() as Pick<
                  Account,
                  'id' | 'acct' | 'avatar' | 'avatar_static'
                >
              }
              size={18}
            />
          </span>
        ))}
      </span>
      <span className='friends-activity-item__label'>
        {interactionEmoji(type)} {nameStr} {interactionLabel(type)} this
      </span>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export
export default ActivityItem;
