import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Icon } from 'mastodon/components/icon';
import { MatePicker } from 'mastodon/features/nudges_messenger/mate_picker';

// Share live location, started on Kronk and sent from Anthemos
// (docs/spaces/map.md, Live location). Kronk never reads a phone's GPS
// itself: a live share is signed by a linked Anthemos phone. So the Map
// only picks the Mate, then hands over to Anthemos, which asks before
// anything leaves the phone. On Android the hand-over is an intent link
// that falls back to `?anthemos=missing` here when the app isn't there;
// elsewhere the button says Anthemos is needed.

const ANTHEMOS_PACKAGE = 'com.anthemos.app.two';
const ANTHEMOS_DOWNLOAD = 'https://anthemos.org/builds/anthemos2-latest.apk';

const messages = defineMessages({
  share: {
    id: 'map.anthemos_share.share',
    defaultMessage: 'Share live',
  },
  pickerTitle: {
    id: 'map.anthemos_share.picker_title',
    defaultMessage: 'Share live location with',
  },
  close: { id: 'map.anthemos_share.close', defaultMessage: 'Close' },
});

const isAndroid = () => /Android/i.test(navigator.userAgent);

const DownloadLink: React.FC = () => (
  <a href={ANTHEMOS_DOWNLOAD} target='_blank' rel='noopener noreferrer'>
    <FormattedMessage
      id='map.anthemos_share.get'
      defaultMessage='Get Anthemos'
    />
  </a>
);

// The intent link: opens Anthemos on the share, or comes back to the Map
// saying it's needed.
const handOver = (account: ApiAccountJSON) => {
  const { origin, host } = window.location;
  const params = new URLSearchParams({ to: account.id, server: host });
  const fallback = encodeURIComponent(`${origin}/hub/map?anthemos=missing`);
  window.location.href =
    `intent://kronk/share?${params.toString()}` +
    `#Intent;scheme=anthemos;package=${ANTHEMOS_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`;
};

// A button on the map beside Near me. On Android it picks a Mate and
// hands over; anywhere else it opens a note saying where live location
// comes from.
export const AnthemosShare: React.FC = () => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const android = isAndroid();

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const pick = useCallback((account: ApiAccountJSON) => {
    setOpen(false);
    handOver(account);
    return Promise.resolve();
  }, []);

  return (
    <>
      <button
        type='button'
        className='map-near-me__toggle anthemos-share'
        onClick={toggle}
        aria-expanded={open}
      >
        <span className='anthemos-share__dot' aria-hidden />
        <span>{intl.formatMessage(messages.share)}</span>
      </button>

      {/* The map's controls sit in a transformed stage, which would trap
          a fixed overlay, so the picker goes to the body. */}
      {open &&
        android &&
        createPortal(
          <MatePicker
            title={intl.formatMessage(messages.pickerTitle)}
            onPick={pick}
            onClose={close}
          />,
          document.body,
        )}

      {open && !android && (
        <div className='anthemos-share__card' role='dialog'>
          <p>
            <FormattedMessage
              id='map.anthemos_share.needs_phone'
              defaultMessage='Live location is exact and comes from your phone, through Anthemos, the Android app. Open the Map on your phone to start sharing.'
            />{' '}
            <DownloadLink />
          </p>
          <button
            type='button'
            className='anthemos-share__close'
            onClick={close}
            aria-label={intl.formatMessage(messages.close)}
          >
            <Icon id='close' icon={CloseIcon} />
          </button>
        </div>
      )}
    </>
  );
};

// Back from a hand-over that found no Anthemos (`?anthemos=missing`).
export const AnthemosMissing: React.FC = () => {
  const intl = useIntl();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const missing =
    new URLSearchParams(location.search).get('anthemos') === 'missing';

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!missing || dismissed) return null;

  return (
    <div className='anthemos-missing' role='status'>
      <p>
        <FormattedMessage
          id='map.anthemos_share.missing'
          defaultMessage='You need the Anthemos app to share live location. It sends where you are from your phone, signed by it, and asks before anything is shared.'
        />{' '}
        <DownloadLink />
      </p>
      <button
        type='button'
        className='anthemos-missing__close'
        onClick={dismiss}
        aria-label={intl.formatMessage(messages.close)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
    </div>
  );
};
