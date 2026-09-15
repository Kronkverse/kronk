import { AccountFields } from 'mastodon/components/account_fields';
import { useAppSelector } from 'mastodon/store';

// The account's federated Mastodon fields (name/value pairs — the
// "Passion / Was the forbidden fruit" pattern on mangobee's
// profile). Rendered on the Profile face below the identity block +
// stats strip.
//
// The joined date used to live here too but moved to
// `<ProfileStatsStrip>` 2026-09-16 — one place for "at a glance"
// info instead of the sparse dt/dd + a separate strip.
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
