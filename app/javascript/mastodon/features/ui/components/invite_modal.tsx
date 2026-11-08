import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { QRCodeSVG } from 'qrcode.react';

import ContentCopyIcon from '@/material-icons/400-24px/content_copy.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { apiRequestGet } from 'mastodon/api';
import { Button } from 'mastodon/components/button';
import { Icon } from 'mastodon/components/icon';

const messages = defineMessages({
  title: {
    id: 'invite_modal.title',
    defaultMessage: 'Invite someone to Kronk',
  },
  blurb: {
    id: 'invite_modal.blurb',
    defaultMessage:
      'Every person you invite becomes part of our community. Please share this link with care — you are a custodian of this space. Help foster the environment you want to see on Kronk.',
  },
  // What goes out with the link (Kommons "Invitation update", 2026-10-30):
  // a short word on what Kronk is, which the inviter can change before
  // copying or sharing it.
  message: {
    id: 'invite_modal.message',
    defaultMessage:
      "Kronk is a small community platform we're building together. Share art and posts, find your Krews, start projekts, swap things on Wachuneed, meet up in Huddle and the Kalendar, and propose what gets built next on the Kommons board.",
  },
  messageLabel: {
    id: 'invite_modal.message_label',
    defaultMessage: 'Message to go with it',
  },
  copy: { id: 'invite_modal.copy', defaultMessage: 'Copy invite' },
  share: { id: 'invite_modal.share', defaultMessage: 'Share' },
  copied: { id: 'invite_modal.copied', defaultMessage: 'Copied!' },
  close: { id: 'invite_modal.close', defaultMessage: 'Close' },
  loading: {
    id: 'invite_modal.loading',
    defaultMessage: 'Generating your invite link...',
  },
  error: {
    id: 'invite_modal.error',
    defaultMessage: 'Could not generate invite link.',
  },
});

interface InviteModalProps {
  onClose: () => void;
}

interface InviteResponse {
  code: string;
  url: string;
}

const InviteModal: React.FC<InviteModalProps> = ({ onClose }) => {
  const intl = useIntl();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState(() =>
    intl.formatMessage(messages.message),
  );
  const canShare = typeof navigator.share === 'function';

  useEffect(() => {
    apiRequestGet<InviteResponse>('v1/invites/personal')
      .then((data) => {
        setInviteUrl(data.url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
    },
    [],
  );

  const handleShare = useCallback(() => {
    if (!inviteUrl) return;
    navigator
      .share({ text: message.trim() || undefined, url: inviteUrl })
      .catch(() => {
        // Closing the share sheet is a choice, not a failure.
      });
  }, [inviteUrl, message]);

  const handleCopy = useCallback(() => {
    if (inviteUrl) {
      const note = message.trim();
      void navigator.clipboard.writeText(
        note ? `${note}\n\n${inviteUrl}` : inviteUrl,
      );
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  }, [inviteUrl, message]);

  const handleSelectAll = useCallback<
    React.MouseEventHandler<HTMLInputElement>
  >((e) => {
    e.currentTarget.select();
  }, []);

  return (
    <div className='modal-root__modal safety-action-modal invite-modal'>
      <div className='safety-action-modal__top'>
        <div className='safety-action-modal__confirmation'>
          <h1>{intl.formatMessage(messages.title)}</h1>
          <p>{intl.formatMessage(messages.blurb)}</p>
        </div>

        {loading && (
          <p className='invite-modal__loading'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {error && (
          <p className='invite-modal__error'>
            {intl.formatMessage(messages.error)}
          </p>
        )}

        {inviteUrl && (
          <>
            <div className='invite-modal__qr-code'>
              <QRCodeSVG
                value={inviteUrl}
                size={180}
                bgColor='#ffffff'
                fgColor='#000000'
                level='M'
                marginSize={2}
              />
            </div>

            <label className='invite-modal__message'>
              <span className='invite-modal__message-label'>
                {intl.formatMessage(messages.messageLabel)}
              </span>
              <textarea
                value={message}
                onChange={handleMessageChange}
                rows={4}
                className='invite-modal__message-input'
              />
            </label>

            <div className='invite-modal__link-row'>
              <input
                type='text'
                readOnly
                value={inviteUrl}
                className='invite-modal__link-input'
                onClick={handleSelectAll}
              />
              <Button
                onClick={handleCopy}
                className='invite-modal__copy-button'
              >
                <Icon id='copy' icon={ContentCopyIcon} />
                {copied
                  ? intl.formatMessage(messages.copied)
                  : intl.formatMessage(messages.copy)}
              </Button>
              {canShare && (
                <Button
                  onClick={handleShare}
                  className='invite-modal__copy-button'
                  secondary
                >
                  <Icon id='share' icon={ShareIcon} />
                  {intl.formatMessage(messages.share)}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className='safety-action-modal__bottom'>
        <div className='safety-action-modal__actions'>
          <button onClick={onClose} className='link-button'>
            {intl.formatMessage(messages.close)}
          </button>
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export
export default InviteModal;
