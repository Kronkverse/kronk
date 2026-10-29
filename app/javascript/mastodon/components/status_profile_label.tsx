import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { Icon } from 'mastodon/components/icon';

// Above a post that was written on someone's profile: whose. Shown
// wherever the post is, since the post is its author's and travels as any
// post does (docs/spaces/profile.md, Posts from Mates). One that is `only`
// there (`self_only`) says so: it is in no one's feed.
export const StatusProfileLabel: React.FC<{
  acct: string;
  name: string;
  only?: boolean;
}> = ({ acct, name, only = false }) => (
  <div className='status__prepend'>
    <div className='status__prepend__icon'>
      <Icon id='person' icon={PersonIcon} />
    </div>
    {only ? (
      <FormattedMessage
        id='status.only_on_profile'
        defaultMessage='Only on {name}’s profile, not in feeds'
        values={{ name: <Link to={`/@${acct}`}>{name}</Link> }}
      />
    ) : (
      <FormattedMessage
        id='status.on_profile'
        defaultMessage='On {name}’s profile'
        values={{ name: <Link to={`/@${acct}`}>{name}</Link> }}
      />
    )}
  </div>
);
