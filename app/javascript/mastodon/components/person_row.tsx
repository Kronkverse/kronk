import { Link } from 'react-router-dom';

import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

// Who's in a space, one row each: picture, name and handle, opening that
// person. The full list behind a <PeopleRow>, for a Krew's People and a
// group chat's Members (docs/design.md, Platform primitives).

export const PersonRow: React.FC<{ account: ApiAccountJSON }> = ({
  account,
}) => {
  const model = createAccountFromServerJSON(account);
  return (
    <li className='person-row'>
      <Link to={`/@${account.acct}`} className='person-row__who'>
        <Avatar account={model} size={36} />
        <span className='person-row__name'>
          {model.display_name || account.username}
        </span>
        <span className='person-row__acct'>@{account.acct}</span>
      </Link>
    </li>
  );
};

export const PersonList: React.FC<{ people: ApiAccountJSON[] }> = ({
  people,
}) => (
  <ul className='person-list'>
    {people.map((account) => (
      <PersonRow key={account.id} account={account} />
    ))}
  </ul>
);
