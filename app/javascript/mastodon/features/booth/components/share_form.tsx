import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';

import type { BoothSet } from '../types';

const messages = defineMessages({
  heading: { id: 'booth.share.heading', defaultMessage: 'Share to feed' },
  placeholder: {
    id: 'booth.share.placeholder',
    defaultMessage: 'Add a comment (optional)',
  },
  cancel: { id: 'booth.share.cancel', defaultMessage: 'Cancel' },
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
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComment(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSharing(true);
      setError(null);

      void api()
        .post(`/api/v1/booth_sets/${set.id}/share`, { comment })
        .then(() => {
          onSuccess();
        })
        .catch(() => {
          setError(intl.formatMessage(messages.error));
          setSharing(false);
        });
    },
    [set.id, comment, onSuccess, intl],
  );

  const previewBody = `${set.title} — ${set.artist_name}\n\n${window.location.origin}/booth/sets/${set.id}`;

  return (
    <form className='booth-upload-form' onSubmit={handleSubmit}>
      <h3 className='booth-upload-form__heading'>
        {intl.formatMessage(messages.heading)}
      </h3>

      {error && <div className='booth-upload-form__error'>{error}</div>}

      <label className='booth-upload-form__field'>
        <textarea
          value={comment}
          onChange={handleCommentChange}
          placeholder={intl.formatMessage(messages.placeholder)}
          rows={3}
          maxLength={500}
          disabled={sharing}
        />
      </label>

      <pre className='booth-share-form__preview'>{previewBody}</pre>

      <div className='booth-upload-form__actions'>
        <button
          type='button'
          className='booth-upload-form__cancel'
          onClick={onCancel}
          disabled={sharing}
        >
          {intl.formatMessage(messages.cancel)}
        </button>
        <button
          type='submit'
          className='booth-upload-form__submit'
          disabled={sharing}
        >
          {sharing
            ? intl.formatMessage(messages.sharing)
            : intl.formatMessage(messages.submit)}
        </button>
      </div>
    </form>
  );
};
