import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { ComposeBody, ComposeHint } from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

import type { BoothSet } from '../types';

// Share a set to the feed: a post carrying the set's card, at the reach
// the member picks. Every member can already find the set in the Booth;
// this is what puts it in people's feeds.

const messages = defineMessages({
  heading: { id: 'booth.share.heading', defaultMessage: 'Share to feed' },
  placeholder: {
    id: 'booth.share.placeholder',
    defaultMessage: 'Say something about it (optional)',
  },
  submit: { id: 'booth.share.submit', defaultMessage: 'Share' },
  sharing: { id: 'booth.share.sharing', defaultMessage: 'Sharing…' },
  error: {
    id: 'booth.share.error',
    defaultMessage: 'Could not share — please try again.',
  },
});

interface Props {
  set: BoothSet;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ShareForm: React.FC<Props> = ({ set, onSuccess, onCancel }) => {
  const intl = useIntl();
  const [comment, setComment] = useState('');
  const [reach, setReach] = useState<ReachValue>('public');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComment(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    setSharing(true);
    setError(null);

    void api()
      .post(`/api/v1/booth_sets/${set.id}/share`, {
        comment,
        visibility: reach,
      })
      .then(() => {
        onSuccess();
      })
      .catch(() => {
        setError(intl.formatMessage(messages.error));
        setSharing(false);
      });
  }, [set.id, comment, reach, onSuccess, intl]);

  return (
    <ComposeShell
      korner='booth'
      label={intl.formatMessage(messages.heading)}
      subtitle={`${set.title} — ${set.artist_name}`}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.sharing)}
      submitting={sharing}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      headerAction={
        <ReachDropdown value={reach} onChange={setReach} disabled={sharing} />
      }
    >
      {error && <ComposeHint error>{error}</ComposeHint>}

      <ComposeBody
        value={comment}
        onChange={handleCommentChange}
        placeholder={intl.formatMessage(messages.placeholder)}
        aria-label={intl.formatMessage(messages.placeholder)}
        rows={3}
        maxLength={500}
        disabled={sharing}
      />
    </ComposeShell>
  );
};
