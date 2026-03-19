import { useState, useEffect, useCallback, useMemo } from 'react';

import { FormattedMessage } from 'react-intl';

import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

interface Account {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  acct: string;
}

interface Props {
  eventId: string;
  onDone: () => void;
}

const FollowerRow: React.FC<{
  account: Account;
  selected: boolean;
  invited: boolean;
  onToggle: (id: string) => void;
}> = ({ account, selected, invited, onToggle }) => {
  const handleChange = useCallback(() => {
    if (!invited) {
      onToggle(account.id);
    }
  }, [onToggle, account.id, invited]);

  const className = invited
    ? 'invite-followers-panel__account invite-followers-panel__account--invited'
    : 'invite-followers-panel__account';

  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={className}>
      <input
        type='checkbox'
        checked={invited || selected}
        disabled={invited}
        onChange={handleChange}
      />
      <img
        src={account.avatar}
        alt=''
        className='invite-followers-panel__avatar'
      />
      <div className='invite-followers-panel__name'>
        <span className='invite-followers-panel__display-name'>
          {account.display_name || account.username}
        </span>
        <span className='invite-followers-panel__acct'>@{account.acct}</span>
      </div>
      {invited && (
        <span className='invite-followers-panel__invited-badge'>
          <FormattedMessage id='events.already_invited' defaultMessage='Invited' />
        </span>
      )}
    </label>
  );
};

export const InviteFollowersPanel: React.FC<Props> = ({ eventId, onDone }) => {
  const [followers, setFollowers] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [alreadyInvited, setAlreadyInvited] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [credRes, inviteesRes] = await Promise.all([
          api().get<Account>('/api/v1/accounts/verify_credentials'),
          api().get<{ account_ids: string[] }>(`/api/v1/events/${eventId}/my_invitees`),
        ]);
        const accountId = credRes.data.id;
        setAlreadyInvited(new Set(inviteesRes.data.account_ids));

        const followersRes = await api().get<Account[]>(`/api/v1/accounts/${accountId}/followers`, { params: { limit: 80 } });
        setFollowers(followersRes.data);

        const linkHeader = followersRes.headers.link as string | undefined;
        if (linkHeader) {
          const match = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
          if (match) setNextUrl(match[1] ?? null);
        }
      } catch (err) {
        console.error('Failed to fetch followers:', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [eventId]);

  const loadMore = useCallback(async () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api().get<Account[]>(nextUrl);
      setFollowers(prev => [...prev, ...res.data]);

      const linkHeader = res.headers.link as string | undefined;
      if (linkHeader) {
        const match = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
        setNextUrl(match?.[1] ?? null);
      } else {
        setNextUrl(null);
      }
    } catch (err) {
      console.error('Failed to load more followers:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextUrl, loadingMore]);

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const toggleAccount = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const filteredFollowers = useMemo(() => {
    if (!search) return followers;
    const lowerSearch = search.toLowerCase();
    return followers.filter(a =>
      a.display_name.toLowerCase().includes(lowerSearch) ||
      a.acct.toLowerCase().includes(lowerSearch)
    );
  }, [followers, search]);

  const selectAll = useCallback(() => {
    const visible = filteredFollowers.filter(a => !alreadyInvited.has(a.id)).map(a => a.id);
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = visible.every(id => next.has(id));
      if (allSelected) {
        visible.forEach(id => next.delete(id));
      } else {
        visible.forEach(id => next.add(id));
      }
      return next;
    });
  }, [filteredFollowers, alreadyInvited]);

  const handleInvite = useCallback(async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      await api().post(`/api/v1/events/${eventId}/invite`, {
        account_ids: Array.from(selected),
      });
      onDone();
    } catch (err) {
      console.error('Failed to send invites:', err);
    } finally {
      setSending(false);
    }
  }, [eventId, selected, onDone]);

  const handleInviteClick = useCallback(() => {
    void handleInvite();
  }, [handleInvite]);

  const selectableFollowers = filteredFollowers.filter(a => !alreadyInvited.has(a.id));
  const allVisibleSelected = selectableFollowers.length > 0 && selectableFollowers.every(a => selected.has(a.id));

  return (
    <div className='invite-followers-panel'>
      <div className='invite-followers-panel__header'>
        <h3>
          <FormattedMessage id='events.invite_followers' defaultMessage='Invite Followers' />
        </h3>
        <span className='invite-followers-panel__count'>
          {selected.size > 0 && (
            <FormattedMessage
              id='events.invite_selected'
              defaultMessage='{count} selected'
              values={{ count: selected.size }}
            />
          )}
        </span>
      </div>

      <div className='invite-followers-panel__search'>
        <Icon id='search' icon={SearchIcon} />
        <input
          type='text'
          placeholder='Search followers...'
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      <div className='invite-followers-panel__select-all'>
        <label htmlFor='select-all-followers'>
          <input
            id='select-all-followers'
            type='checkbox'
            checked={allVisibleSelected}
            onChange={selectAll}
          />
          <FormattedMessage id='events.select_all' defaultMessage='Select all' />
        </label>
      </div>

      <div className='invite-followers-panel__list'>
        {loading ? (
          <div className='invite-followers-panel__loading'>
            <FormattedMessage id='events.loading_followers' defaultMessage='Loading followers...' />
          </div>
        ) : filteredFollowers.length === 0 ? (
          <div className='invite-followers-panel__empty'>
            <FormattedMessage id='events.no_followers' defaultMessage='No followers found' />
          </div>
        ) : (
          <>
            {filteredFollowers.map(account => (
              <FollowerRow
                key={account.id}
                account={account}
                selected={selected.has(account.id)}
                invited={alreadyInvited.has(account.id)}
                onToggle={toggleAccount}
              />
            ))}
            {nextUrl && !search && (
              <button
                className='invite-followers-panel__load-more'
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      <div className='invite-followers-panel__actions'>
        <button className='invite-followers-panel__skip' onClick={onDone}>
          <FormattedMessage id='events.skip_invites' defaultMessage='Skip' />
        </button>
        <button
          className='invite-followers-panel__send'
          onClick={handleInviteClick}
          disabled={sending || selected.size === 0}
        >
          {sending ? (
            <FormattedMessage id='events.sending_invites' defaultMessage='Sending...' />
          ) : (
            <FormattedMessage
              id='events.send_invites'
              defaultMessage='Send {count, plural, one {# invite} other {# invites}}'
              values={{ count: selected.size }}
            />
          )}
        </button>
      </div>
    </div>
  );
};
