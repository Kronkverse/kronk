import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { ComposeBody, ComposeHint } from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

import type { Proposal } from '../types';

// Share a proposal to the feed with a note (Kommons "Add share function to
// proposals"): a post of your own, the note and the proposal's link, which
// the feed draws as the proposal's card. The proposal's own post, its
// discussion, stays where it is. Same shape as the Booth's Share to feed.

const messages = defineMessages({
  heading: {
    id: 'kommons.share.heading',
    defaultMessage: 'Share to feed',
  },
  placeholder: {
    id: 'kommons.share.placeholder',
    defaultMessage: 'Say why it matters (optional)',
  },
  submit: { id: 'kommons.share.submit', defaultMessage: 'Share' },
  sharing: { id: 'kommons.share.sharing', defaultMessage: 'Sharing…' },
  error: {
    id: 'kommons.share.error',
    defaultMessage: 'Could not share it. Please try again.',
  },
});

interface Props {
  proposal: Proposal;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ProposalShareForm: React.FC<Props> = ({
  proposal,
  onSuccess,
  onCancel,
}) => {
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
      .post(`/api/v1/proposals/${proposal.id}/share`, {
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
  }, [proposal.id, comment, reach, onSuccess, intl]);

  return (
    <ComposeShell
      konnect={null}
      korner='kommons'
      label={intl.formatMessage(messages.heading)}
      subtitle={proposal.title}
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
