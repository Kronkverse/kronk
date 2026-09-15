import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { FormattedDateWrapper } from 'mastodon/components/formatted_date';
import { ShortNumber } from 'mastodon/components/short_number';
import { useAppSelector } from 'mastodon/store';

// The "at a glance" strip. A four-stat row (Joined · Posts · Mates)
// that sits directly under the identity block, replacing the sparse
// scatter of the joined date living in ProfileMeta and the counts
// living up in the profile block. Same information, one place — Tal
// 2026-09-16: "tidbits of info" as a dedicated strip.
//
// Top-korner shows once the cutover backfill migration runs and the
// account has at least one visible ProfileSection with a
// `settings.korner_slug`. Until then the strip renders three stats
// and the shelves show the empty state.
//
// Reads from the shared account record — no new API needed. Locale
// formatting flows through `<FormattedDateWrapper>` and
// `<ShortNumber>` the way every other stat row does.

const messages = defineMessages({
  joinedLabel: {
    id: 'profile_stats_strip.joined',
    defaultMessage: 'Joined',
  },
  postsLabel: {
    id: 'profile_stats_strip.posts',
    defaultMessage: 'Posts',
  },
  matesLabel: {
    id: 'profile_stats_strip.mates',
    defaultMessage: 'Mates',
  },
  topKornerLabel: {
    id: 'profile_stats_strip.top_korner',
    defaultMessage: 'Most in',
  },
});

export const ProfileStatsStrip: React.FC<{
  accountId: string;
  topKornerName?: string;
}> = ({ accountId, topKornerName }) => {
  const intl = useIntl();
  const account = useAppSelector((state) => state.accounts.get(accountId));

  if (!account) return null;

  return (
    <dl className='profile-stats-strip' aria-label='At a glance'>
      <div className='profile-stats-strip__stat'>
        <dt className='profile-stats-strip__label'>
          {intl.formatMessage(messages.joinedLabel)}
        </dt>
        <dd className='profile-stats-strip__value'>
          <FormattedDateWrapper
            value={account.created_at}
            year='numeric'
            month='short'
          />
        </dd>
      </div>

      <div className='profile-stats-strip__stat'>
        <dt className='profile-stats-strip__label'>
          <FormattedMessage {...messages.postsLabel} />
        </dt>
        <dd className='profile-stats-strip__value'>
          <ShortNumber value={account.statuses_count} />
        </dd>
      </div>

      <div className='profile-stats-strip__stat'>
        <dt className='profile-stats-strip__label'>
          <FormattedMessage {...messages.matesLabel} />
        </dt>
        <dd className='profile-stats-strip__value'>
          <ShortNumber value={account.followers_count} />
        </dd>
      </div>

      {topKornerName && (
        <div className='profile-stats-strip__stat'>
          <dt className='profile-stats-strip__label'>
            <FormattedMessage {...messages.topKornerLabel} />
          </dt>
          <dd className='profile-stats-strip__value'>{topKornerName}</dd>
        </div>
      )}
    </dl>
  );
};
