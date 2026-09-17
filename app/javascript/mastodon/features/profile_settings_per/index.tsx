/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

// /@:acct/settings — per-person settings for the account whose
// profile you were just on. Parallel to the /nudges/:id/settings
// "chat info" surface (#1889 + #1893): tapping the Ж menu's Settings
// verb from a profile brings you HERE, not to the account-wide hub.
//
// Signal-shaped: a Stage takes over the pane; back-arrow returns to
// the profile. Actions are the relationship controls that used to
// live only in per-account dropdowns and were awkward to reach from
// a phone: mute, block, remove Mate, report. Same components +
// actions the profile page always used — just gathered on one
// dedicated surface with room to breathe.

import { useCallback, useEffect } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import {
  fetchAccount,
  lookupAccount,
  blockAccount,
  unblockAccount,
  muteAccount,
  unmuteAccount,
  unmateAccount,
} from 'mastodon/actions/accounts';
import { initReport } from 'mastodon/actions/reports';
import { Avatar } from 'mastodon/components/avatar';
import { Stage } from 'mastodon/components/stage';
import { AccountNote } from 'mastodon/features/account/components/account_note';
import { me } from 'mastodon/initial_state';
import { normalizeForLookup } from 'mastodon/reducers/accounts_map';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: {
    id: 'profile_settings.title',
    defaultMessage: 'Settings for {name}',
  },
  titleFallback: {
    id: 'profile_settings.title_fallback',
    defaultMessage: 'Person settings',
  },
  back: {
    id: 'profile_settings.back',
    defaultMessage: 'Back to profile',
  },

  sectionSilence: {
    id: 'profile_settings.section.silence',
    defaultMessage: 'Silence',
  },
  mute: {
    id: 'profile_settings.mute',
    defaultMessage: 'Mute posts',
  },
  muteHint: {
    id: 'profile_settings.mute_hint',
    defaultMessage:
      'Their posts stop appearing in your feeds; notifications from them are silenced too. Reversible any time.',
  },
  unmute: {
    id: 'profile_settings.unmute',
    defaultMessage: 'Unmute',
  },

  sectionBoundary: {
    id: 'profile_settings.section.boundary',
    defaultMessage: 'Boundary',
  },
  block: {
    id: 'profile_settings.block',
    defaultMessage: 'Block',
  },
  blockHint: {
    id: 'profile_settings.block_hint',
    defaultMessage:
      'They can no longer see your posts, mention you, or send you nudges. If you were Mates, that ends.',
  },
  unblock: {
    id: 'profile_settings.unblock',
    defaultMessage: 'Unblock',
  },

  sectionRelationship: {
    id: 'profile_settings.section.relationship',
    defaultMessage: 'Relationship',
  },
  sectionNote: {
    id: 'profile_settings.section.note',
    defaultMessage: 'Your private note',
  },
  unmate: {
    id: 'profile_settings.unmate',
    defaultMessage: 'Remove Mate',
  },
  unmateHint: {
    id: 'profile_settings.unmate_hint',
    defaultMessage:
      'End the Mate connection. You can request again later; they will get a Mate request.',
  },
  unmateConfirm: {
    id: 'profile_settings.unmate_confirm',
    defaultMessage: 'Remove {name} as a Mate?',
  },

  report: {
    id: 'profile_settings.report',
    defaultMessage: 'Report',
  },
  reportHint: {
    id: 'profile_settings.report_hint',
    defaultMessage: "Send this account to the instance's moderators.",
  },

  self: {
    id: 'profile_settings.self',
    defaultMessage: 'These settings apply to how other people reach you.',
  },
  selfLink: {
    id: 'profile_settings.self_link',
    defaultMessage: 'Open your account settings',
  },

  loading: {
    id: 'profile_settings.loading',
    defaultMessage: 'Loading\u2026',
  },
  unavailable: {
    id: 'profile_settings.unavailable',
    defaultMessage: 'Account not available.',
  },
});

export const ProfileSettingsPer: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { acct } = useParams<{ acct: string }>();

  const accountId = useAppSelector((state) =>
    acct ? (state.accounts_map[normalizeForLookup(acct)] ?? null) : null,
  );
  const account = useAppSelector((state) =>
    accountId ? state.accounts.get(accountId) : undefined,
  );
  const relationship = useAppSelector((state) =>
    accountId ? state.relationships.get(accountId) : undefined,
  );
  const isSelf = accountId === me;

  // Look up by acct if we don't yet have the account cached; then
  // refresh the record + relationship so the toggles reflect truth.
  useEffect(() => {
    if (!acct) return;
    if (!accountId) {
      dispatch(lookupAccount(acct));
    } else {
      dispatch(fetchAccount(accountId));
    }
  }, [acct, accountId, dispatch]);

  const handleMute = useCallback(() => {
    if (!accountId) return;
    if (relationship?.get('muting')) {
      dispatch(unmuteAccount(accountId));
    } else {
      dispatch(muteAccount(accountId));
    }
  }, [accountId, relationship, dispatch]);

  const handleBlock = useCallback(() => {
    if (!accountId) return;
    if (relationship?.get('blocking')) {
      dispatch(unblockAccount(accountId));
    } else {
      dispatch(blockAccount(accountId));
    }
  }, [accountId, relationship, dispatch]);

  const handleUnmate = useCallback(() => {
    if (!accountId || !account) return;
    const name = account.get('display_name') || account.get('username');
    if (!window.confirm(intl.formatMessage(messages.unmateConfirm, { name }))) {
      return;
    }
    dispatch(unmateAccount(accountId));
  }, [accountId, account, dispatch, intl]);

  const handleReport = useCallback(() => {
    if (!account) return;
    dispatch(initReport(account, null));
  }, [account, dispatch]);

  const backHref = acct ? `/@${acct}` : '/';
  const displayName = account
    ? account.get('display_name') || account.get('username')
    : (acct ?? '');
  const title = account
    ? intl.formatMessage(messages.title, { name: displayName })
    : intl.formatMessage(messages.titleFallback);

  if (!account) {
    return (
      <Stage label={intl.formatMessage(messages.titleFallback)}>
        <div className='profile-settings-per'>
          <p className='profile-settings-per__status'>
            {intl.formatMessage(
              accountId === null && acct
                ? messages.loading
                : messages.unavailable,
            )}
          </p>
        </div>
      </Stage>
    );
  }

  const muted = relationship?.get('muting') ?? false;
  const blocked = relationship?.get('blocking') ?? false;
  const isMate = relationship?.get('mate') ?? false;

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='profile-settings-per'>
        <header className='profile-settings-per__head'>
          <Link
            to={backHref}
            className='profile-settings-per__back'
            aria-label={intl.formatMessage(messages.back)}
          >
            <ArrowBackIcon />
          </Link>
          <h1 className='profile-settings-per__title'>{title}</h1>
        </header>

        <div className='profile-settings-per__hero'>
          <Avatar account={account} size={72} />
          <div className='profile-settings-per__hero-name'>{displayName}</div>
          <div className='profile-settings-per__hero-handle'>
            @{account.get('acct')}
          </div>
        </div>

        {isSelf ? (
          <section className='profile-settings-per__section'>
            <p className='profile-settings-per__self-note'>
              <FormattedMessage {...messages.self} />
            </p>
            <Link className='profile-settings-per__link' to='/settings/privacy'>
              <FormattedMessage {...messages.selfLink} />
            </Link>
          </section>
        ) : (
          <>
            <section className='profile-settings-per__section'>
              <h2 className='profile-settings-per__section-title'>
                <FormattedMessage {...messages.sectionSilence} />
              </h2>
              <ActionRow
                label={intl.formatMessage(
                  muted ? messages.unmute : messages.mute,
                )}
                hint={intl.formatMessage(messages.muteHint)}
                active={muted}
                onClick={handleMute}
              />
            </section>

            <section className='profile-settings-per__section'>
              <h2 className='profile-settings-per__section-title'>
                <FormattedMessage {...messages.sectionBoundary} />
              </h2>
              <ActionRow
                label={intl.formatMessage(
                  blocked ? messages.unblock : messages.block,
                )}
                hint={intl.formatMessage(messages.blockHint)}
                active={blocked}
                destructive
                onClick={handleBlock}
              />
            </section>

            <section className='profile-settings-per__section'>
              <h2 className='profile-settings-per__section-title'>
                <FormattedMessage {...messages.sectionRelationship} />
              </h2>
              {isMate && (
                <ActionRow
                  label={intl.formatMessage(messages.unmate)}
                  hint={intl.formatMessage(messages.unmateHint)}
                  destructive
                  onClick={handleUnmate}
                />
              )}
              <ActionRow
                label={intl.formatMessage(messages.report)}
                hint={intl.formatMessage(messages.reportHint)}
                onClick={handleReport}
              />
            </section>

            {/* Viewer's own private note ABOUT this person. Moved here
                2026-09-16 from inline on the profile face, where the
                "Click to add note" placeholder made it look like part
                of THEIR profile rather than your private annotation.
                Same component, same actions, private-notes-with-the-
                other-private-controls IA. */}
            {accountId && (
              <section className='profile-settings-per__section'>
                <h2 className='profile-settings-per__section-title'>
                  <FormattedMessage {...messages.sectionNote} />
                </h2>
                <AccountNote accountId={accountId} />
              </section>
            )}
          </>
        )}
      </div>
    </Stage>
  );
};

const ActionRow: React.FC<{
  label: string;
  hint: string;
  active?: boolean;
  destructive?: boolean;
  onClick: () => void;
}> = ({ label, hint, active, destructive, onClick }) => (
  <button
    type='button'
    className='profile-settings-per__row'
    data-active={active ? 'true' : undefined}
    data-destructive={destructive ? 'true' : undefined}
    onClick={onClick}
  >
    <span className='profile-settings-per__row-label'>{label}</span>
    <span className='profile-settings-per__row-hint'>{hint}</span>
  </button>
);

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default ProfileSettingsPer;
