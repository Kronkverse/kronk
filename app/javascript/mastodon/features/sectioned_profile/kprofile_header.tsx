import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { me } from 'mastodon/initial_state';

// Independent header for the SectionedProfile route (/@user). Does NOT
// reuse any `.account__header__*` class names from upstream Mastodon —
// that would drag every layout property into a specificity fight with
// container queries + media rules the classic profile ships. The new
// `.kprofile__*` namespace stands on its own.
//
// Scope is deliberately narrow: identity strip only. Bell / share /
// familiar-followers / follow-button live back in AccountHeader for
// non-sectioned views. Edit-profile is the single owner action here.

const messages = defineMessages({
  edit: { id: 'kprofile.edit', defaultMessage: 'Edit profile' },
  posts: { id: 'kprofile.stats.posts', defaultMessage: 'Posts' },
  followers: { id: 'kprofile.stats.followers', defaultMessage: 'Followers' },
  following: { id: 'kprofile.stats.following', defaultMessage: 'Following' },
  joined: { id: 'kprofile.meta.joined', defaultMessage: 'Joined {date}' },
  ownerBadge: { id: 'kprofile.owner_badge', defaultMessage: '◈ Owner' },
});

const formatJoinDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export const KProfileHeader: React.FC<{ account: ApiAccountJSON }> = ({
  account,
}) => {
  const intl = useIntl();
  const isOwner = account.id === me;

  return (
    <header className='kprofile'>
      <div className='kprofile__cover' aria-hidden />

      <div className='kprofile__headwrap'>
        <img
          className='kprofile__avatar'
          src={account.avatar}
          alt=''
        />

        <div className='kprofile__identity'>
          <div className='kprofile__nameline'>
            <h1
              className='kprofile__name'
              // account.display_name is server-sanitised HTML with custom
              // emoji shortcodes replaced by <img> tags for animated
              // variants — safe to render.
              dangerouslySetInnerHTML={{
                __html: account.display_name || account.username,
              }}
            />
            {isOwner && (
              <a href='/settings/profile' className='kprofile__edit'>
                {intl.formatMessage(messages.edit)}
              </a>
            )}
          </div>

          <p className='kprofile__handle'>
            <span className='kprofile__handle-acct'>@{account.acct}</span>
            {isOwner && (
              <span className='kprofile__owner'>
                {intl.formatMessage(messages.ownerBadge)}
              </span>
            )}
          </p>

          {account.note && (
            <div
              className='kprofile__bio'
              dangerouslySetInnerHTML={{ __html: account.note }}
            />
          )}

          <div className='kprofile__metarow'>
            <span className='kprofile__meta-item'>
              <span className='kprofile__meta-icon' aria-hidden>✦</span>
              <FormattedMessage
                id='kprofile.meta.joined'
                defaultMessage='Joined {date}'
                values={{ date: formatJoinDate(account.created_at) }}
              />
            </span>
          </div>
        </div>

        <div className='kprofile__stats' role='list'>
          <div className='kprofile__stat' role='listitem'>
            <b>{account.statuses_count}</b>
            <span>{intl.formatMessage(messages.posts)}</span>
          </div>
          <div className='kprofile__stat' role='listitem'>
            <b>{account.followers_count}</b>
            <span>{intl.formatMessage(messages.followers)}</span>
          </div>
          <div className='kprofile__stat' role='listitem'>
            <b>{account.following_count}</b>
            <span>{intl.formatMessage(messages.following)}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
