import { FormattedMessage } from 'react-intl';

import { AccountFields } from 'mastodon/components/account_fields';
import { FormattedDateWrapper } from 'mastodon/components/formatted_date';
import { useAppSelector } from 'mastodon/store';

// The joined date + the account's metadata fields, as they used to
// appear in the legacy profile header. They come down here with the
// bio and the personal note when the block is only identity
// (docs/spaces/profile.md § What moves below).
//
// Not to be confused with the profile *field catalog* (pronouns,
// location, …) — those are profile_cards and render on the board
// below. These four are Mastodon's federated `fields_attributes`.

export const ProfileMeta: React.FC<{ accountId: string }> = ({ accountId }) => {
  const account = useAppSelector((state) => state.accounts.get(accountId));

  if (!account) return null;

  return (
    <div className='profile-face__meta'>
      <dl>
        <dt>
          <FormattedMessage id='account.joined_short' defaultMessage='Joined' />
        </dt>
        <dd>
          <FormattedDateWrapper
            value={account.created_at}
            year='numeric'
            month='short'
            day='2-digit'
          />
        </dd>
      </dl>

      <AccountFields fields={account.fields} emojis={account.emojis} />
    </div>
  );
};
