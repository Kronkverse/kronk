import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Moon } from './moon';
import type { KlotShare, PhaseKey } from '../types';
import { PHASE_NAMES } from '../phase_math';

const messages = defineMessages({
  addPlaceholder: {
    id: 'klot.share.add_placeholder',
    defaultMessage: '@username to add',
  },
  add: { id: 'klot.share.add', defaultMessage: 'Add' },
  removeShare: {
    id: 'klot.share.remove',
    defaultMessage: 'Stop sharing',
  },
});

interface Props {
  shares: KlotShare[];
  currentPhase: PhaseKey;
  onAdd: (acct: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export const ShareCard: React.FC<Props> = ({
  shares,
  currentPhase,
  onAdd,
  onRemove,
}) => {
  const intl = useIntl();
  const [pending, setPending] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async () => {
    const acct = pending.trim().replace(/^@/, '');
    if (!acct || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(acct);
      setPending('');
    } catch (_e) {
      setError(
        intl.formatMessage({
          id: 'klot.share.error',
          defaultMessage:
            "Couldn't add that person — check the username and try again.",
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [pending, busy, onAdd, intl]);

  return (
    <div className='klot-card'>
      <h3 className='klot-card__title serif'>
        <FormattedMessage id='klot.share.title' defaultMessage='Shared with' />
      </h3>
      <p className='klot-card__lead'>
        <FormattedMessage
          id='klot.share.lead'
          defaultMessage='Only these people can see where you are. They see a moon and a phase — never your dates, days, or notes.'
        />
      </p>

      <div className='klot-badge-preview'>
        <span className='klot-badge-preview__label'>
          <FormattedMessage
            id='klot.share.preview_they_see'
            defaultMessage='They see'
          />
        </span>
        <span className='klot-badge-preview__phase'>
          <Moon phase={currentPhase} size={16} />
          <span>{PHASE_NAMES[currentPhase]}</span>
        </span>
      </div>

      <ul className='klot-viewers'>
        {shares.map((s) => (
          <li key={s.id} className='klot-viewers__item'>
            <span className='klot-viewers__avatar'>
              {s.viewer_account.display_name?.[0] ??
                s.viewer_account.username?.[0] ??
                '·'}
            </span>
            <span className='klot-viewers__name'>
              <span>{s.viewer_account.display_name || s.viewer_account.username}</span>
              <span className='klot-viewers__handle'>
                @{s.viewer_account.acct}
              </span>
            </span>
            <button
              type='button'
              className='klot-viewers__remove'
              aria-label={intl.formatMessage(messages.removeShare)}
              onClick={async () => {
                await onRemove(s.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {shares.length === 0 && (
        <p className='klot-card__empty'>
          <FormattedMessage
            id='klot.share.empty'
            defaultMessage='No one yet. Your cycle is yours.'
          />
        </p>
      )}

      <div className='klot-share-add'>
        <input
          type='text'
          className='klot-field__input'
          placeholder={intl.formatMessage(messages.addPlaceholder)}
          value={pending}
          onChange={(e) => {
            setPending(e.target.value);
          }}
        />
        <button
          type='button'
          className='klot-secondary-btn'
          disabled={busy || pending.trim().length === 0}
          onClick={handleAdd}
        >
          {intl.formatMessage(messages.add)}
        </button>
      </div>
      {error && <p className='klot-card__error'>{error}</p>}
    </div>
  );
};
