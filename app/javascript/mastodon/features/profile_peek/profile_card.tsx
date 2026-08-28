import { useCallback, useEffect, useState } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { useHistory } from 'react-router-dom';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import {
  fetchRelationships,
  mateAccount,
  unmateAccount,
} from 'mastodon/actions/accounts';
import { apiGetMatuals } from 'mastodon/api/accounts';
import type { ApiMatualsJSON } from 'mastodon/api/accounts';
import { Icon } from 'mastodon/components/icon';
import { useIdentity } from 'mastodon/identity_context';
import { me } from 'mastodon/initial_state';
import type { Account } from 'mastodon/models/account';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// Standard profile card. Phone-screen-shaped (9:19.5). The card is
// the atomic unit of the profile-peek modal, the Kommunity Discover
// deck, and (planned) Krew members deck — every place a preview of a
// person needs to render, this component draws.
//
// Content is deliberately terse per Tal 2026-08-28:
//   - cover photo (account.header)
//   - profile photo breaking the cover baseline (account.avatar)
//   - display name + @handle
//   - bio (account.note, stripped of tags)
//   - Matuals row — mates in common (label + stacked avatars + copy)
//   - bottom action row — two circular icon buttons: Mate? and Open
//
// The "Ж since …" pill and the Kommunity-orb-style stat lines were
// intentionally left out (Tal — "just keep it cover photo, profile
// photo, name, and user-written description" + subsequent nudges).

const messages = defineMessages({
  matuals: { id: 'profile_card.matuals', defaultMessage: 'Matuals' },
  matualsMore: {
    id: 'profile_card.matuals_more',
    defaultMessage: '{first} + {rest, plural, one {# more} other {# more}}',
  },
  matualsTwo: {
    id: 'profile_card.matuals_two',
    defaultMessage: '{first} + {rest, plural, one {# more} other {# more}}',
  },
  mate: { id: 'profile_card.mate', defaultMessage: 'Mate?' },
  mating: { id: 'profile_card.mating', defaultMessage: 'Withdraw request' },
  unmate: { id: 'profile_card.unmate', defaultMessage: 'Unmate' },
  openProfile: {
    id: 'profile_card.open_profile',
    defaultMessage: 'Open profile',
  },
});

// Strip HTML tags from Mastodon-formatted bio for the terse card
// render. The shelved profile still gets the rich version.
const stripHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? ''; // eslint-disable-line @typescript-eslint/no-unnecessary-condition
};

// Format the matuals-row copy. Backend gives us up to 6 previews +
// the total count; we pick the first two by display name to lead
// with, plus a "+N more" tail.
const matualsCopy = (
  intl: ReturnType<typeof useIntl>,
  data: ApiMatualsJSON,
): string | null => {
  if (data.count === 0) return null;
  const [first, second] = data.previews;
  if (!first) return null;
  if (data.count === 1) return first.display_name;
  const secondName = second?.display_name;
  const lead = secondName
    ? `${first.display_name}, ${secondName}`
    : first.display_name;
  const rest = data.count - (secondName ? 2 : 1);
  if (rest <= 0) return lead;
  return intl.formatMessage(messages.matualsMore, { first: lead, rest });
};

// The icon button that carries the Mate state. Three visuals: send
// (person + plus), pending (hourglass), mate (check). Own account
// hides the button — the CTA is "edit profile" and lives on the
// shelved profile header, not on a peek of yourself.
const MateIconButton: React.FC<{ accountId: string }> = ({ accountId }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();
  const relationship = useAppSelector((state) =>
    state.relationships.get(accountId),
  );

  useEffect(() => {
    if (signedIn) dispatch(fetchRelationships([accountId]));
  }, [dispatch, accountId, signedIn]);

  const handleClick = useCallback(() => {
    if (!signedIn || !relationship) return;
    if (relationship.mate || relationship.requested) {
      dispatch(unmateAccount(accountId));
    } else {
      dispatch(mateAccount(accountId));
    }
  }, [dispatch, accountId, signedIn, relationship]);

  if (accountId === me) return null;

  const state: 'mate' | 'pending' | 'send' = relationship?.mate
    ? 'mate'
    : relationship?.requested
      ? 'pending'
      : 'send';

  const label = intl.formatMessage(
    state === 'mate'
      ? messages.unmate
      : state === 'pending'
        ? messages.mating
        : messages.mate,
  );

  return (
    <button
      type='button'
      className={`profile-card__icon profile-card__icon--mate profile-card__icon--${state}`}
      onClick={handleClick}
      aria-label={label}
      title={label}
      disabled={!signedIn}
    >
      <Icon
        id='mate'
        icon={
          state === 'mate'
            ? CheckIcon
            : state === 'pending'
              ? HourglassIcon
              : PersonAddIcon
        }
      />
    </button>
  );
};

interface Props {
  account: Account;
  onOpen?: () => void;
}

export const ProfileCard: React.FC<Props> = ({ account, onOpen }) => {
  const intl = useIntl();
  const history = useHistory();
  const [matuals, setMatuals] = useState<ApiMatualsJSON | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGetMatuals(account.id)
      .then((data) => {
        if (!cancelled) setMatuals(data);
      })
      .catch(() => {
        if (!cancelled) setMatuals({ count: 0, previews: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const openHref = `/@${account.acct}`;
  const handleOpen = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Cmd/ctrl-click stays as a real anchor navigation (opens in a
      // new tab); a plain click closes the peek + routes via SPA.
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      onOpen?.();
      history.push(openHref);
    },
    [history, onOpen, openHref],
  );

  const bio = account.note ? stripHtml(account.note).trim() : '';
  const displayName = account.display_name.trim() || account.username;
  const matualsLine = matuals ? matualsCopy(intl, matuals) : null;

  return (
    <article className='profile-card' aria-label={displayName}>
      <div
        className={`profile-card__cover${account.header && !account.header.includes('missing.png') ? '' : ' profile-card__cover--fallback'}`}
        style={
          account.header && !account.header.includes('missing.png')
            ? { backgroundImage: `url("${account.header}")` }
            : undefined
        }
      >
        <div
          className='profile-card__avatar'
          style={{ backgroundImage: `url("${account.avatar}")` }}
          aria-hidden='true'
        />
      </div>

      <div className='profile-card__body'>
        <h2 className='profile-card__name'>{displayName}</h2>
        <div className='profile-card__handle'>@{account.acct}</div>

        {bio && <p className='profile-card__bio'>{bio}</p>}

        {matuals && matuals.count > 0 && (
          <div
            className='profile-card__matuals'
            role='group'
            aria-label={intl.formatMessage(messages.matuals)}
          >
            <div className='profile-card__matuals-label'>
              {intl.formatMessage(messages.matuals)}
            </div>
            <div className='profile-card__matuals-row'>
              <span className='profile-card__matuals-stack' aria-hidden='true'>
                {matuals.previews.slice(0, 3).map((m) => (
                  <span
                    key={m.id}
                    className='profile-card__matuals-avatar'
                    style={{ backgroundImage: `url("${m.avatar}")` }}
                  />
                ))}
              </span>
              {matualsLine && (
                <span className='profile-card__matuals-copy'>
                  {matualsLine}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className='profile-card__actions'>
        <MateIconButton accountId={account.id} />
        <a
          className='profile-card__icon profile-card__icon--open'
          href={openHref}
          onClick={handleOpen}
          aria-label={intl.formatMessage(messages.openProfile)}
          title={intl.formatMessage(messages.openProfile)}
        >
          <Icon id='open' icon={ChevronRightIcon} />
        </a>
      </div>
    </article>
  );
};
