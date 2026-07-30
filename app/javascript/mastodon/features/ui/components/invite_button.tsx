import { useCallback, useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import PersonAddIcon from '@/material-icons/400-24px/person_add-fill.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { Icon } from 'mastodon/components/icon';
import { useAppDispatch } from 'mastodon/store';

// Invite button — pinned to the top-right of the KronkFrame TopBand
// grid (column 3). Opens the existing InviteModal (QR + shareable link)
// wired through the `'INVITE'` entry in MODAL_COMPONENTS. Kept as its
// own component so KronkFrame slot children stay small + declarative.
//
// Deliberately styled to stand out — solid Kronk-purple pill with a
// glow. The whole point of the surface is "invite people you know",
// which is one of the actions Kronk wants to be discoverable.
//
// Rails-served pages (/kronk/*, /invites — see
// `app/views/shared/_kronk_static_chrome.html.haml`) render a static
// twin of this button as a plain <a href="/home?invite=1"> because
// they can't dispatch to the React store. The useEffect below picks
// that deep-link up on SPA mount and opens the modal, then cleans the
// query param so a page refresh doesn't reopen it. Same button, same
// modal, regardless of where the click started.

const messages = defineMessages({
  invite: {
    id: 'kronk_frame.invite',
    defaultMessage: 'Invite someone to Kronk',
  },
});

export const InviteButton: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const history = useHistory();

  const handleClick = useCallback(() => {
    dispatch(openModal({ modalType: 'INVITE', modalProps: {} }));
  }, [dispatch]);

  // Deep-link from the static-chrome invite button — /home?invite=1
  // (or any SPA URL carrying invite=1) opens the modal immediately and
  // strips the param so refresh/history don't retrigger it.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('invite') !== '1') return;

    dispatch(openModal({ modalType: 'INVITE', modalProps: {} }));

    params.delete('invite');
    const nextSearch = params.toString();
    history.replace({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: location.hash,
    });
  }, [dispatch, history, location.hash, location.pathname, location.search]);

  const label = intl.formatMessage(messages.invite);

  return (
    <button
      type='button'
      className='kronk-invite-button'
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      <Icon
        id='person_add'
        icon={PersonAddIcon}
        className='kronk-invite-button__icon'
      />
    </button>
  );
};
