import { useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { importFetchedAccounts } from 'mastodon/actions/importer';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { MateIconButton } from 'mastodon/features/profile_peek/profile_card';
import { useAppDispatch } from 'mastodon/store';

// People first (Tal 2026-10-11, Kommons proposal "Search Results Suck").
//
// The rest of the results are one list in date order, and a person is dated
// by when they joined, so someone who has been here a year sank below every
// recent comment that mentions them. Looking for a person is the commonest
// search there is, so people get their own strip above the list: a small
// card each, with the same Mate button the profile card carries.
//
// The strip is a native sideways scroller, like <ListingPhotos>.

const messages = defineMessages({
  heading: { id: 'kronk_search.people.heading', defaultMessage: 'People' },
});

const PersonCard: React.FC<{ account: ApiAccountJSON }> = ({ account }) => {
  const name = account.display_name.trim() || account.username;

  return (
    <li className='kronk-search__person'>
      <Link to={`/@${account.acct}`} className='kronk-search__person-link'>
        <Avatar account={account} size={64} />
        <span className='kronk-search__person-name'>{name}</span>
        <span className='kronk-search__person-handle'>@{account.acct}</span>
      </Link>
      <MateIconButton accountId={account.id} />
    </li>
  );
};

export const PeopleStrip: React.FC<{ accounts: ApiAccountJSON[] }> = ({
  accounts,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  // The Mate button reads its state from the store.
  useEffect(() => {
    if (accounts.length > 0) dispatch(importFetchedAccounts(accounts));
  }, [dispatch, accounts]);

  if (accounts.length === 0) return null;

  const heading = intl.formatMessage(messages.heading);

  return (
    <section className='kronk-search__people' aria-label={heading}>
      <h2 className='kronk-search__heading'>{heading}</h2>
      <ul className='kronk-search__people-track'>
        {accounts.map((account) => (
          <PersonCard key={account.id} account={account} />
        ))}
      </ul>
    </section>
  );
};
