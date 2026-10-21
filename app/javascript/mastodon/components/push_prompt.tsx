import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import { register as registerPush } from 'mastodon/actions/push_notifications';
import { Icon } from 'mastodon/components/icon';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useAppDispatch } from 'mastodon/store';

// Turning push on for this device (docs/spaces/nudges.md, Push). The
// browser only asks when a person taps something, so this is that
// something. On an iPhone, push works only from Kronk added to the Home
// Screen (iOS 16.4 and later), so outside it this explains how instead.
//
//   strip    — top of Nudges → Notifications, until it's on or dismissed
//   settings — the "This device" row on /settings/notifications

const messages = defineMessages({
  turnOn: {
    id: 'push_prompt.turn_on',
    defaultMessage: 'Turn on notifications',
  },
  turnOnBody: {
    id: 'push_prompt.turn_on_body',
    defaultMessage: 'Hear about messages and nudges on this device.',
  },
  iosTitle: {
    id: 'push_prompt.ios_title',
    defaultMessage: 'Get notifications on your iPhone',
  },
  iosBody: {
    id: 'push_prompt.ios_body',
    defaultMessage:
      'Tap Share, then Add to Home Screen, and open Kronk from there. Then turn notifications on here. Needs iOS 16.4 or later.',
  },
  blocked: {
    id: 'push_prompt.blocked',
    defaultMessage:
      'Notifications are blocked for Kronk. Allow them in your browser or phone settings, then come back.',
  },
  unsupported: {
    id: 'push_prompt.unsupported',
    defaultMessage: 'This browser can’t show notifications.',
  },
  on: {
    id: 'push_prompt.on',
    defaultMessage: 'Notifications are on for this device.',
  },
  dismiss: { id: 'push_prompt.dismiss', defaultMessage: 'Not now' },
});

type PushState = 'on' | 'ask' | 'blocked' | 'ios-install' | 'unsupported';

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const readState = (): PushState => {
  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  if (isIos() && !isStandalone()) return 'ios-install';
  if (!supported) return 'unsupported';
  if (Notification.permission === 'granted') return 'on';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ask';
};

const DISMISS_KEY = 'kronk.pushPrompt.dismissed';

const readDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export const PushPrompt: React.FC<{ variant: 'strip' | 'settings' }> = ({
  variant,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [state, setState] = useState<PushState>(readState);
  const [dismissed, setDismissed] = useState(readDismissed);

  const handleTurnOn = useCallback(() => {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') dispatch(registerPush());
      setState(readState());
    });
  }, [dispatch]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private window: it just comes back next time.
    }
  }, []);

  if (variant === 'strip') {
    if (dismissed || (state !== 'ask' && state !== 'ios-install')) return null;

    const ios = state === 'ios-install';
    return (
      <div className='push-prompt'>
        <Icon id='notifications' icon={NotificationsIcon} />
        <div className='push-prompt__body'>
          <strong>
            {intl.formatMessage(ios ? messages.iosTitle : messages.turnOn)}
          </strong>
          <span>
            {intl.formatMessage(ios ? messages.iosBody : messages.turnOnBody)}
          </span>
        </div>
        {!ios && (
          <KornerPill
            variant='primary'
            label={intl.formatMessage(messages.turnOn)}
            onClick={handleTurnOn}
          />
        )}
        <button
          type='button'
          className='push-prompt__dismiss'
          onClick={handleDismiss}
          aria-label={intl.formatMessage(messages.dismiss)}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      </div>
    );
  }

  switch (state) {
    case 'ask':
      return (
        <KornerPill
          variant='primary'
          label={intl.formatMessage(messages.turnOn)}
          onClick={handleTurnOn}
        />
      );
    case 'on':
      return (
        <span className='push-prompt__note'>
          {intl.formatMessage(messages.on)}
        </span>
      );
    case 'blocked':
      return (
        <span className='push-prompt__note'>
          {intl.formatMessage(messages.blocked)}
        </span>
      );
    case 'ios-install':
      return (
        <span className='push-prompt__note'>
          {intl.formatMessage(messages.iosBody)}
        </span>
      );
    default:
      return (
        <span className='push-prompt__note'>
          {intl.formatMessage(messages.unsupported)}
        </span>
      );
  }
};
