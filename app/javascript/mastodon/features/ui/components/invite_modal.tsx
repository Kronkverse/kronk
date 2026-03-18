import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { QRCodeSVG } from 'qrcode.react';

import ContentCopyIcon from '@/material-icons/400-24px/content_copy.svg?react';
import { apiRequestGet } from 'mastodon/api';
import { Button } from 'mastodon/components/button';
import { Icon } from 'mastodon/components/icon';

const messages = defineMessages({
  title: { id: 'invite_modal.title', defaultMessage: 'Invite someone to Kronk' },
  blurb: {
    id: 'invite_modal.blurb',
    defaultMessage: 'Every person you invite becomes part of our community. Please share this link with care — you are a custodian of this space. Help foster the environment you want to see on Kronk.',
  },
  copy: { id: 'invite_modal.copy', defaultMessage: 'Copy link' },
  copied: { id: 'invite_modal.copied', defaultMessage: 'Copied!' },
  close: { id: 'invite_modal.close', defaultMessage: 'Close' },
  loading: { id: 'invite_modal.loading', defaultMessage: 'Generating your invite link...' },
  error: { id: 'invite_modal.error', defaultMessage: 'Could not generate invite link.' },
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

  const handleCopy = useCallback(() => {
    if (inviteUrl) {
      void navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [inviteUrl]);

  return (
    <div className='modal-root__modal safety-action-modal invite-modal'>
      <div className='safety-action-modal__top'>
        <div className='safety-action-modal__confirmation'>
          <h1>{intl.formatMessage(messages.title)}</h1>
          <p>{intl.formatMessage(messages.blurb)}</p>
        </div>

        {loading && (
          <p className='invite-modal__loading'>{intl.formatMessage(messages.loading)}</p>
        )}

        {error && (
          <p className='invite-modal__error'>{intl.formatMessage(messages.error)}</p>
        )}

        {inviteUrl && (
          <>
            <div className='invite-modal__qr-code'>
              <QRCodeSVG
                value={inviteUrl}
                size={180}
                bgColor='#ffffff'
                fgColor='#000000'
                level='H'
                marginSize={2}
                imageSettings={{
                  src: '/icon.png',
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>

            <div className='invite-modal__link-row'>
              <input
                type='text'
                readOnly
                value={inviteUrl}
                className='invite-modal__link-input'
                onClick={(e) => { (e.target as HTMLInputElement).select(); }}
              />
              <Button onClick={handleCopy} className='invite-modal__copy-button'>
                <Icon id='copy' icon={ContentCopyIcon} />
                {copied ? intl.formatMessage(messages.copied) : intl.formatMessage(messages.copy)}
              </Button>
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
