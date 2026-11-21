import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import LocationIcon from '@/material-icons/400-24px/location_on.svg?react';
import {
  apiGetAnthemosLinks,
  apiGetOwnLiveShares,
  apiStopLiveShare,
} from 'mastodon/api/map_live';
import type { ApiOwnLiveShareJSON } from 'mastodon/api/map_live';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Icon } from 'mastodon/components/icon';
import { MatePicker } from 'mastodon/features/nudges_messenger/mate_picker';

// Your location, from Anthemos (docs/spaces/map.md, Your location button).
// The pin button top left holds everything Anthemos does on the Map: Share
// (live location with a Mate), Update (your pin, to where the phone is) and
// the shares running now, each with Stop. Kronk never reads a phone's GPS
// itself, so Share and Update hand over to Anthemos, which asks before
// anything leaves the phone. Shown only once a phone is linked.

const ANTHEMOS_PACKAGE = 'com.anthemos.app.two';
const ANTHEMOS_DOWNLOAD = 'https://anthemos.org/builds/anthemos2-latest.apk';

const messages = defineMessages({
  button: { id: 'map.location.button', defaultMessage: 'Your location' },
  share: { id: 'map.location.share', defaultMessage: 'Share' },
  shareHint: {
    id: 'map.location.share_hint',
    defaultMessage: 'Live location with a Mate',
  },
  update: { id: 'map.location.update', defaultMessage: 'Update' },
  updateHint: {
    id: 'map.location.update_hint',
    defaultMessage: 'Move your pin to where you are',
  },
  pickerTitle: {
    id: 'map.location.picker_title',
    defaultMessage: 'Share live location with',
  },
  sharing: {
    id: 'map.location.sharing',
    defaultMessage: 'Sharing with {names} until {time}',
  },
  stop: { id: 'map.location.stop', defaultMessage: 'Stop' },
  close: { id: 'map.location.close', defaultMessage: 'Close' },
});

const isAndroid = () => /Android/i.test(navigator.userAgent);

const DownloadLink: React.FC = () => (
  <a href={ANTHEMOS_DOWNLOAD} target='_blank' rel='noopener noreferrer'>
    <FormattedMessage id='map.location.get' defaultMessage='Get Anthemos' />
  </a>
);

// The intent link: opens Anthemos on Share or Update, or comes back to the
// Map saying it's needed.
const handOver = (action: 'share' | 'update', to?: string) => {
  const { origin, host } = window.location;
  const params = new URLSearchParams({ server: host });
  if (to) params.set('to', to);
  const fallback = encodeURIComponent(`${origin}/hub/map?anthemos=missing`);
  window.location.href =
    `intent://kronk/${action}?${params.toString()}` +
    `#Intent;scheme=anthemos;package=${ANTHEMOS_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`;
};

interface Props {
  // Dropped below the in-view pill when that takes the corner.
  lower: boolean;
}

export const LocationMenu: React.FC<Props> = ({ lower }) => {
  const intl = useIntl();
  const [linked, setLinked] = useState(false);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [elsewhere, setElsewhere] = useState(false);
  const [shares, setShares] = useState<ApiOwnLiveShareJSON[]>([]);
  const android = isAndroid();

  useEffect(() => {
    let cancelled = false;
    apiGetAnthemosLinks()
      .then((links) => {
        if (!cancelled) setLinked(links.length > 0);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The shares running now: once linked, and fresh each time the menu opens.
  useEffect(() => {
    if (!linked) return;
    let cancelled = false;
    apiGetOwnLiveShares()
      .then((rows) => {
        if (!cancelled) setShares(rows);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [linked, open]);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
    setElsewhere(false);
  }, []);
  const share = useCallback(() => {
    if (android) setPicking(true);
    else setElsewhere(true);
  }, [android]);
  const update = useCallback(() => {
    if (android) {
      setOpen(false);
      handOver('update');
    } else {
      setElsewhere(true);
    }
  }, [android]);
  const closePicker = useCallback(() => {
    setPicking(false);
  }, []);
  const pick = useCallback((account: ApiAccountJSON) => {
    setPicking(false);
    setOpen(false);
    handOver('share', account.id);
    return Promise.resolve();
  }, []);
  const stop = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.value;
    void apiStopLiveShare(id).then(() => {
      setShares((rows) => rows.filter((row) => row.id !== id));
      return undefined;
    });
  }, []);

  if (!linked) return null;

  return (
    <div className={`map-location${lower ? ' map-location--lower' : ''}`}>
      <button
        type='button'
        className='map-location__button'
        onClick={toggle}
        aria-expanded={open}
        aria-label={intl.formatMessage(messages.button)}
        title={intl.formatMessage(messages.button)}
      >
        <Icon id='location_on' icon={LocationIcon} />
        {shares.length > 0 && (
          <span className='map-location__live' aria-hidden />
        )}
      </button>

      {open && (
        <div className='map-location__menu'>
          <button type='button' className='map-location__item' onClick={share}>
            <span className='map-location__item-title'>
              {intl.formatMessage(messages.share)}
            </span>
            <span className='map-location__item-hint'>
              {intl.formatMessage(messages.shareHint)}
            </span>
          </button>
          <button type='button' className='map-location__item' onClick={update}>
            <span className='map-location__item-title'>
              {intl.formatMessage(messages.update)}
            </span>
            <span className='map-location__item-hint'>
              {intl.formatMessage(messages.updateHint)}
            </span>
          </button>

          {elsewhere && (
            <p className='map-location__note'>
              <FormattedMessage
                id='map.location.needs_phone'
                defaultMessage='This comes from Anthemos on your phone. Open the Map there.'
              />
            </p>
          )}

          {shares.map((row) => (
            <div key={row.id} className='map-location__share'>
              <span className='map-location__dot' aria-hidden />
              <span className='map-location__share-text'>
                {intl.formatMessage(messages.sharing, {
                  names: row.recipients.map((r) => r.name).join(', '),
                  time: intl.formatTime(row.expires_at, {
                    hour: 'numeric',
                    minute: '2-digit',
                  }),
                })}
              </span>
              <button
                type='button'
                value={row.id}
                onClick={stop}
                className='map-location__stop'
              >
                {intl.formatMessage(messages.stop)}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The map's controls sit in a transformed stage, which would trap
          a fixed overlay, so the picker goes to the body. */}
      {picking &&
        createPortal(
          <MatePicker
            title={intl.formatMessage(messages.pickerTitle)}
            onPick={pick}
            onClose={closePicker}
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
          id='map.location.missing'
          defaultMessage='You need the Anthemos app on this phone to share or update your location. It sends where you are, signed by the phone, and asks before anything is shared.'
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
