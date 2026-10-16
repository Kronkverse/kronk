import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiDeleteKlotViewer,
  apiGetKlotViewers,
  apiPostKlotViewer,
} from 'mastodon/api/klot';
import type { ApiKlotViewerJSON } from 'mastodon/api/klot';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { KornerPill } from 'mastodon/components/korner_pill';
import { MatePicker } from 'mastodon/features/nudges_messenger/mate_picker';

// Who may see your phase. They see a moon and a phase name, never dates,
// days, symptoms or notes (Api::V1::Klot::CircleController is the
// contract). Add a Mate with the picker; the x stops sharing at once.

const messages = defineMessages({
  title: { id: 'klot.shared.title', defaultMessage: 'Shared with' },
  lead: {
    id: 'klot.shared.lead',
    defaultMessage:
      'Only these people can see where you are. They see a moon and a phase — never your dates, days, or notes.',
  },
  empty: {
    id: 'klot.shared.empty',
    defaultMessage: 'No one yet. Your cycle is yours.',
  },
  remove: { id: 'klot.shared.remove', defaultMessage: 'Stop sharing' },
  add: { id: 'klot.shared.add', defaultMessage: 'Share with a Mate' },
  pickerTitle: {
    id: 'klot.shared.picker_title',
    defaultMessage: 'Share your phase with',
  },
  sharing: { id: 'klot.shared.sharing', defaultMessage: 'Sharing' },
});

export const SharedWith: React.FC = () => {
  const intl = useIntl();
  const [viewers, setViewers] = useState<ApiKlotViewerJSON[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    void apiGetKlotViewers()
      .then(setViewers)
      .catch(() => undefined);
  }, []);

  const openPicker = useCallback(() => {
    setPicking(true);
  }, []);
  const closePicker = useCallback(() => {
    setPicking(false);
  }, []);

  const handlePick = useCallback(async (account: ApiAccountJSON) => {
    const viewer = await apiPostKlotViewer(account.id);
    setViewers((prev) =>
      prev.some((v) => v.account_id === viewer.account_id)
        ? prev
        : [...prev, viewer],
    );
  }, []);

  const sharingLabel = intl.formatMessage(messages.sharing);
  const doneLabel = useCallback(
    (account: ApiAccountJSON) =>
      viewers.some((v) => v.account_id === account.id) ? sharingLabel : null,
    [sharingLabel, viewers],
  );

  const handleRemove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const accountId = e.currentTarget.dataset.accountId;
    if (!accountId) return;
    void apiDeleteKlotViewer(accountId).then(() => {
      setViewers((prev) => prev.filter((v) => v.account_id !== accountId));
    });
  }, []);

  return (
    <section className='klot-card'>
      <h2 className='klot-card__title'>{intl.formatMessage(messages.title)}</h2>
      <p className='klot-card__lead'>{intl.formatMessage(messages.lead)}</p>

      {viewers.length === 0 ? (
        <div className='klot-card__empty'>
          {intl.formatMessage(messages.empty)}
        </div>
      ) : (
        <ul className='klot-card__viewers'>
          {viewers.map((v) => (
            <li key={v.account_id} className='klot-card__viewer'>
              <span className='klot-card__viewer-avatar' aria-hidden='true'>
                {v.name.charAt(0).toUpperCase()}
              </span>
              <span className='klot-card__viewer-identity'>
                <span className='klot-card__viewer-name'>{v.name}</span>
                <span className='klot-card__viewer-handle'>@{v.handle}</span>
              </span>
              <button
                type='button'
                data-account-id={v.account_id}
                onClick={handleRemove}
                aria-label={intl.formatMessage(messages.remove)}
                className='klot-card__viewer-remove'
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className='klot-day__actions'>
        <KornerPill
          onClick={openPicker}
          label={intl.formatMessage(messages.add)}
        />
      </div>

      {picking && (
        <MatePicker
          title={intl.formatMessage(messages.pickerTitle)}
          onPick={handlePick}
          doneLabel={doneLabel}
          onClose={closePicker}
        />
      )}
    </section>
  );
};
