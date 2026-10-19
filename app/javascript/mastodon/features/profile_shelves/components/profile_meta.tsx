import { AccountFields } from 'mastodon/components/account_fields';
import { useAppSelector } from 'mastodon/store';

// The account's federated Mastodon fields (name/value pairs — the
// "Passion / Was the forbidden fruit" pattern on mangobee's
// profile). Rendered on the Profile face below the profile block.
//
// The joined date used to live here too; it is in the profile block's
// counts line now, beside Posts and Mates.
//
// Not to be confused with the profile *field catalog* (pronouns,
// location, …) — those are profile_cards and render on the board
// below via `<ProfileIdentity>`. These four (up to four, per
// Mastodon) are `fields_attributes` from the federated account
// record.

export const ProfileMeta: React.FC<{ accountId: string }> = ({ accountId }) => {
  const account = useAppSelector((state) => state.accounts.get(accountId));

  if (!account || account.fields.isEmpty()) return null;

  return (
    <div className='profile-face__meta'>
      <AccountFields fields={account.fields} emojis={account.emojis} />
    </div>
  );
};
