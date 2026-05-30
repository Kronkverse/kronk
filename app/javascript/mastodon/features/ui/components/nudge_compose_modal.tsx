import { useCallback, useRef, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import { apiNudgeAccount } from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Button } from 'mastodon/components/button';
import { Icon } from 'mastodon/components/icon';
import { useAppSelector } from 'mastodon/store';

const MAX_WORDS = 100;

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

export const NudgeComposeModal: React.FC<{
  accountId: string;
  onClose: () => void;
  onSent?: (streak: number) => void;
}> = ({ accountId, onClose, onSent }) => {
  const account = useAppSelector((state) => state.accounts.get(accountId));
  const [text, setText] = useState('');
  const [mediaId, setMediaId] = useState<string | undefined>();
  const [mediaPreview, setMediaPreview] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = countWords(text);
  const overLimit = wordCount > MAX_WORDS;

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      void (async () => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const csrfMeta = document.querySelector<HTMLMetaElement>(
            'meta[name="csrf-token"]',
          );
          const response = await fetch('/api/v2/media', {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRF-Token': csrfMeta?.content ?? '' },
            credentials: 'same-origin',
          });
          if (response.ok) {
            const json = (await response.json()) as { id: string };
            setMediaId(json.id);
            setMediaPreview(URL.createObjectURL(file));
          }
        } finally {
          setUploading(false);
        }
      })();
    },
    [],
  );

  const handleRemoveImage = useCallback(() => {
    setMediaId(undefined);
    setMediaPreview(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const send = useCallback(
    async (withMessage: boolean) => {
      if (sending) return;
      setSending(true);
      try {
        const params = withMessage
          ? { text: text.trim() || undefined, media_id: mediaId }
          : {};
        const result = await apiNudgeAccount(accountId, params);
        onSent?.(result.streak);
        onClose();
      } finally {
        setSending(false);
      }
    },
    [accountId, text, mediaId, sending, onSent, onClose],
  );

  const handleJustNudge = useCallback(() => void send(false), [send]);
  const handleSendNudge = useCallback(() => void send(true), [send]);

  if (!account) return null;

  const hasMessage = text.trim().length > 0 || !!mediaId;

  return (
    <div className='modal-root__modal nudge-compose-modal'>
      <div className='nudge-compose-modal__header'>
        <Icon icon={PartnerExchangeIcon} id='partner_exchange' />
        <h2>
          <FormattedMessage
            id='nudge_compose.title'
            defaultMessage='Nudge @{acct}'
            values={{ acct: account.acct }}
          />
        </h2>
      </div>

      <div className='nudge-compose-modal__recipient'>
        <Avatar account={account} size={36} />
        <span className='nudge-compose-modal__recipient-name'>
          {account.display_name || account.acct}
        </span>
      </div>

      <div className='nudge-compose-modal__body'>
        <textarea
          className='nudge-compose-modal__textarea'
          placeholder='Add a message… (optional)'
          value={text}
          onChange={handleTextChange}
          rows={4}
          maxLength={2000}
        />

        <div className='nudge-compose-modal__counter-row'>
          <button
            className='nudge-compose-modal__attach-btn'
            onClick={handleAttachClick}
            disabled={uploading || !!mediaId}
            type='button'
          >
            {uploading ? (
              <FormattedMessage
                id='nudge_compose.uploading'
                defaultMessage='Uploading…'
              />
            ) : (
              <FormattedMessage
                id='nudge_compose.attach_image'
                defaultMessage='Attach image'
              />
            )}
          </button>

          <span
            className={`nudge-compose-modal__word-count${overLimit ? ' nudge-compose-modal__word-count--over' : ''}`}
          >
            {wordCount}/{MAX_WORDS}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {mediaPreview && (
          <div className='nudge-compose-modal__preview'>
            <img
              src={mediaPreview}
              alt=''
              className='nudge-compose-modal__preview-img'
            />
            <button
              className='nudge-compose-modal__remove-img'
              onClick={handleRemoveImage}
              type='button'
              aria-label='Remove image'
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className='nudge-compose-modal__actions'>
        <button className='link-button' onClick={onClose}>
          <FormattedMessage
            id='confirmation_modal.cancel'
            defaultMessage='Cancel'
          />
        </button>

        <div className='nudge-compose-modal__send-group'>
          {hasMessage ? (
            <Button disabled={sending || overLimit} onClick={handleSendNudge}>
              <FormattedMessage
                id='nudge_compose.send_nudge'
                defaultMessage='Send nudge'
              />
            </Button>
          ) : (
            <Button disabled={sending} onClick={handleJustNudge}>
              <FormattedMessage
                id='nudge_compose.just_nudge'
                defaultMessage='Just nudge'
              />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
