import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

// Sticky header for the shelved profile. Cover + avatar + name +
// handle sit above the pillar-switch and stay pinned across the
// three pillars (Profile / Timeline / Kommunity) — per Tal's note
// on the round-3 empty-state question.
//
// `actions` slot lets the parent drop owner-only affordances (the
// Arrange toggle) inline with the identity row.

interface ProfileHeaderProps {
  account: ApiAccountJSON;
  actions?: React.ReactNode;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  account,
  actions,
}) => {
  const modelAccount = createAccountFromServerJSON(account);
  const displayName = account.display_name || account.username;

  return (
    <header className='profile-shelves__header'>
      <div
        className='profile-shelves__cover'
        style={
          account.header && account.header !== '/headers/original/missing.png'
            ? { backgroundImage: `url(${account.header})` }
            : undefined
        }
      />
      <div className='profile-shelves__ident'>
        <Avatar account={modelAccount} size={86} />
        <div className='profile-shelves__names'>
          <div className='profile-shelves__dname'>{displayName}</div>
          <div className='profile-shelves__handle'>@{account.acct}</div>
        </div>
        {actions && (
          <div className='profile-shelves__acts'>{actions}</div>
        )}
      </div>
    </header>
  );
};
