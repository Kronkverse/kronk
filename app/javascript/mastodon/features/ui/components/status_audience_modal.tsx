import { useEffect, useState } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { apiGetStatusAudience } from 'mastodon/api/statuses';
import type { ApiStatusAudienceJSON } from 'mastodon/api_types/statuses';
import { IconButton } from 'mastodon/components/icon_button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { reachMessages, REACH_META } from 'mastodon/components/reach_dropdown';
import { ScopeMark } from 'mastodon/components/scope_mark';

// "Who can see this?" — the owner-only audience readout for a post
// (docs/rebuild/per_post_audience.md). Fetches the resolved audience on open
// and shows it in plain words: the reach tier (with its glyph), any targeted
// krews, and the people explicitly let in / kept out. The reach graph itself
// isn't enumerated (mates/orbit are described); the value here is seeing the
// scope + the exceptions at a glance.

const REACH_VALUES: readonly ReachValue[] = [
  'public',
  'mates',
  'orbit',
  'self_only',
];

const messages = defineMessages({
  title: { id: 'status.audience.title', defaultMessage: 'Who can see this' },
  close: { id: 'status.audience.close', defaultMessage: 'Close' },
  krews: { id: 'status.audience.krews', defaultMessage: 'Krews' },
  letIn: { id: 'status.audience.let_in', defaultMessage: 'Also let in' },
  keptOut: { id: 'status.audience.kept_out', defaultMessage: 'Kept out' },
});

// The base audience, in words. mates/orbit aren't enumerable person-lists, so
// they're described; public is everyone; self_only is just the author.
const scopeBlurb = (reach: ReachValue, matesCount: number | null) => {
  switch (reach) {
    case 'public':
      return (
        <FormattedMessage
          id='status.audience.blurb.public'
          defaultMessage='Everyone on Kronk.'
        />
      );
    case 'mates':
      return matesCount === null ? (
        <FormattedMessage
          id='status.audience.blurb.mates'
          defaultMessage='Your Mates.'
        />
      ) : (
        <FormattedMessage
          id='status.audience.blurb.mates_count'
          defaultMessage='Your {count, plural, one {# Mate} other {# Mates}}.'
          values={{ count: matesCount }}
        />
      );
    case 'orbit':
      return (
        <FormattedMessage
          id='status.audience.blurb.orbit'
          defaultMessage='Your Mates, and their Mates.'
        />
      );
    case 'self_only':
      return (
        <FormattedMessage
          id='status.audience.blurb.self_only'
          defaultMessage='Just you.'
        />
      );
  }
};

const PersonList: React.FC<{
  label: string;
  accounts: ApiStatusAudienceJSON['added'];
}> = ({ label, accounts }) => {
  if (accounts.length === 0) return null;
  return (
    <div className='status-audience__group'>
      <h4 className='status-audience__group-label'>{label}</h4>
      <ul className='status-audience__people'>
        {accounts.map((account) => (
          <li className='status-audience__person' key={account.id}>
            <img
              className='status-audience__avatar'
              src={account.avatar}
              alt=''
            />
            <span className='status-audience__person-name'>
              {account.display_name || account.username}
            </span>
            <span className='status-audience__person-acct'>
              @{account.acct}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const StatusAudienceModal: React.FC<{
  statusId: string;
  onClose: () => void;
}> = ({ statusId, onClose }) => {
  const intl = useIntl();
  const [audience, setAudience] = useState<ApiStatusAudienceJSON | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiGetStatusAudience(statusId)
      .then((data) => {
        if (!cancelled) setAudience(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [statusId]);

  const reach: ReachValue =
    audience && REACH_VALUES.includes(audience.visibility as ReachValue)
      ? (audience.visibility as ReachValue)
      : 'public';

  return (
    <div className='modal-root__modal dialog-modal status-audience'>
      <div className='dialog-modal__header'>
        <IconButton
          className='dialog-modal__header__close'
          title={intl.formatMessage(messages.close)}
          icon='close'
          iconComponent={CloseIcon}
          onClick={onClose}
        />
        <span className='dialog-modal__header__title'>
          {intl.formatMessage(messages.title)}
        </span>
      </div>

      <div className='dialog-modal__content status-audience__content'>
        {!audience && !failed && <LoadingIndicator />}

        {failed && (
          <p className='status-audience__error'>
            <FormattedMessage
              id='status.audience.error'
              defaultMessage='Couldn’t load who can see this.'
            />
          </p>
        )}

        {audience && (
          <>
            <div className='status-audience__scope'>
              <ScopeMark
                kind={REACH_META[reach].mark}
                size={28}
                className='status-audience__scope-mark'
              />
              <div className='status-audience__scope-text'>
                <span className='status-audience__scope-label'>
                  {intl.formatMessage(reachMessages[REACH_META[reach].labelId])}
                </span>
                <span className='status-audience__scope-blurb'>
                  {scopeBlurb(reach, audience.mates_count)}
                </span>
              </div>
            </div>

            {audience.krews.length > 0 && (
              <div className='status-audience__group'>
                <h4 className='status-audience__group-label'>
                  {intl.formatMessage(messages.krews)}
                </h4>
                <div className='status-audience__krews'>
                  {audience.krews.map((krew) => (
                    <span className='status-audience__krew' key={krew.id}>
                      {krew.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <PersonList
              label={intl.formatMessage(messages.letIn)}
              accounts={audience.added}
            />
            <PersonList
              label={intl.formatMessage(messages.keptOut)}
              accounts={audience.removed}
            />
          </>
        )}
      </div>
    </div>
  );
};
