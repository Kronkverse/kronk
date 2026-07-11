import { Link } from 'react-router-dom';

import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// Top-right avatar bubble. Direct link to the signed-in account's
// profile (Sections view). Replaces the Profile entry in the Ӂ menu —
// keeps the primary you-surface visible even when the menu is closed.

export const AvatarBubble = () => {
  const account = useAppSelector((state) => (me ? state.accounts.get(me) : undefined));

  if (!account) return null;

  const acct = account.get('acct') as string;
  const avatar = account.get('avatar') as string;
  const displayName = (account.get('display_name') as string) || acct;

  return (
    <Link
      to={`/@${acct}`}
      className='avatar-bubble'
      aria-label={`Your profile — ${displayName}`}
      title={displayName}
    >
      <img
        src={avatar}
        alt=''
        className='avatar-bubble__img'
      />
    </Link>
  );
};
