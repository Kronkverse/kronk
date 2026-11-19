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
// elsewhere the panel just says Anthemos is needed.

const ANTHEMOS_PACKAGE = 'com.anthemos.app.two';
const ANTHEMOS_DOWNLOAD = 'https://anthemos.org/builds/anthemos2-latest.apk';

const messages = defineMessages({
  share: {
    id: 'map.anthemos_share.share',
    defaultMessage: 'Share live location',
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

// In the Place me panel, under the place search.
export const AnthemosShare: React.FC = () => {
  const intl = useIntl();
  const [picking, setPicking] = useState(false);

  const open = useCallback(() => {
    setPicking(true);
  }, []);
  const close = useCallback(() => {
    setPicking(false);
  }, []);
  const pick = useCallback((account: ApiAccountJSON) => {
    setPicking(false);
    handOver(account);
    return Promise.resolve();
  }, []);

  if (!isAndroid()) {
    return (
      <div className='anthemos-share'>
        <p className='anthemos-share__note'>
          <FormattedMessage
            id='map.anthemos_share.needs_phone'
            defaultMessage='Live location is shared from Anthemos, the Android app, so it comes from your phone. Open the Map on your phone to start one.'
          />{' '}
          <DownloadLink />
        </p>
      </div>
    );
  }

  return (
    <div className='anthemos-share'>
      <button type='button' className='anthemos-share__button' onClick={open}>
        {intl.formatMessage(messages.share)}
      </button>
      <p className='anthemos-share__note'>
        <FormattedMessage
          id='map.anthemos_share.note'
          defaultMessage='Exact and live, sent from Anthemos on this phone. It asks before sharing.'
        />{' '}
        <FormattedMessage
          id='map.anthemos_share.dont_have'
          defaultMessage="Don't have it?"
        />{' '}
        <DownloadLink />
      </p>
      {/* The panel is transformed, which would trap a fixed overlay
          inside it, so the picker goes to the body. */}
      {picking &&
        createPortal(
          <MatePicker
            title={intl.formatMessage(messages.pickerTitle)}
            onPick={pick}
            onClose={close}
          />,
          document.body,
        )}
    </div>
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
