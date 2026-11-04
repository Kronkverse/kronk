import { PureComponent } from 'react';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';
import { IconButton } from './icon_button';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import SmartphoneIcon from '@/material-icons/400-24px/smartphone.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import {
  ANDROID_APP_URL,
  androidAppBuild,
  inAndroidApp,
} from '../utils/android_app';

import { Icon } from './icon';
import { KornerPill } from './korner_pill';

// An Android browser is offered the Kronk app (kronk-app, a Trusted Web
// Activity: Kronk full-screen, with push); iOS has no app, so it is offered
// the web app on the Home Screen.
//
// Inside the Android app (utils/android_app) there is nothing to install, so
// this offers the app's own update instead: `/version.json` names the
// released build (the legacy app's updater reads the same file), and if it is
// newer than the build that opened this tab, say so. Dismissing it holds for
// that version only.
const messages = defineMessages({
  dismiss: { id: 'pwa.dismiss', defaultMessage: 'Dismiss' },
  appUpdate: { id: 'pwa.app_update', defaultMessage: 'Get it' },
  getApp: { id: 'pwa.get_app', defaultMessage: 'Get it' },
});

const ANDROID_STORAGE_KEY = 'apk_install_dismissed';
const APP_UPDATE_STORAGE_KEY = 'android_app_update_dismissed';
const IOS_STORAGE_KEY = 'ios_pwa_install_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

const detectPlatform = () => {
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return 'android';
  // iPad on iPadOS 13+ reports as Mac but has touch; check both.
  const isIos = /iPhone|iPod/.test(ua) || (/iPad/.test(ua)) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  return null;
};

const isStandalone = () =>
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

class PwaInstallPrompt extends PureComponent {
  state = {
    show: false,
    platform: null,
  };

  componentDidMount() {
    if (inAndroidApp()) {
      void this.checkAppUpdate();
      return;
    }

    const platform = detectPlatform();
    if (!platform) return;

    // Already running from the home screen: nothing to offer.
    if (isStandalone()) return;

    const storageKey = platform === 'ios' ? IOS_STORAGE_KEY : ANDROID_STORAGE_KEY;
    let dismissed = null;
    try {
      dismissed = localStorage.getItem(storageKey);
    } catch {
      // Storage blocked (private mode): just show the prompt.
    }
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        return;
      }
    }

    this.timer = setTimeout(() => {
      this.setState({ show: true, platform });
    }, 2000);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
    this.unmounted = true;
  }

  async checkAppUpdate() {
    const build = androidAppBuild();
    if (!build) return;

    let latest;
    try {
      const response = await fetch('/version.json', { cache: 'no-store' });
      if (!response.ok) return;
      latest = await response.json();
    } catch {
      return;
    }
    if (!latest || !(latest.versionCode > build) || !latest.apkUrl) return;

    try {
      if (localStorage.getItem(APP_UPDATE_STORAGE_KEY) === String(latest.versionCode)) return;
    } catch {
      // Storage blocked: show it.
    }

    if (this.unmounted) return;
    this.setState({ show: true, platform: 'app-update', update: latest });
  }

  handleGetUpdate = () => {
    window.location.href = this.state.update.apkUrl;
  };

  handleGetApp = () => {
    window.location.href = ANDROID_APP_URL;
  };

  handleDismiss = () => {
    const { platform } = this.state;
    if (platform === 'app-update') {
      try {
        localStorage.setItem(APP_UPDATE_STORAGE_KEY, String(this.state.update.versionCode));
      } catch {
        // Storage blocked: it just comes back next visit.
      }
      this.setState({ show: false });
      return;
    }

    const storageKey = platform === 'ios' ? IOS_STORAGE_KEY : ANDROID_STORAGE_KEY;
    try {
      localStorage.setItem(storageKey, Date.now().toString());
    } catch {
      // Storage blocked: it just comes back next visit.
    }
    this.setState({ show: false });
  };

  render() {
    const { show, platform } = this.state;
    if (!show) return null;

    if (platform === 'app-update') {
      return (
        <div className='pwa-install-prompt pwa-install-prompt--android'>
          <div className='pwa-install-prompt__icon'>
            <Icon id='install' icon={SmartphoneIcon} />
          </div>
          <div className='pwa-install-prompt__message'>
            <strong>
              <FormattedMessage
                id='pwa.app_update_title'
                defaultMessage='A new Kronk app is out'
              />
            </strong>
            <span>
              <FormattedMessage
                id='pwa.app_update_message'
                defaultMessage='Install it over this one. You stay signed in.'
              />
            </span>
          </div>
          <div className='pwa-install-prompt__actions'>
            <KornerPill
              variant='primary'
              label={this.props.intl.formatMessage(messages.appUpdate)}
              onClick={this.handleGetUpdate}
            />
            <IconButton
              icon='close'
              iconComponent={CloseIcon}
              onClick={this.handleDismiss}
              title={this.props.intl.formatMessage(messages.dismiss)}
              className='pwa-install-prompt__close'
            />
          </div>
        </div>
      );
    }

    if (platform === 'android') {
      return (
        <div className='pwa-install-prompt pwa-install-prompt--android'>
          <div className='pwa-install-prompt__icon'>
            <Icon id='install' icon={SmartphoneIcon} />
          </div>
          <div className='pwa-install-prompt__message'>
            <strong>
              <FormattedMessage
                id='pwa.get_app_title'
                defaultMessage='Get the Kronk app'
              />
            </strong>
            <span>
              <FormattedMessage
                id='pwa.get_app_message'
                defaultMessage='Kronk full screen on your phone, with notifications.'
              />
            </span>
          </div>
          <div className='pwa-install-prompt__actions'>
            <KornerPill
              variant='primary'
              label={this.props.intl.formatMessage(messages.getApp)}
              onClick={this.handleGetApp}
            />
            <IconButton
              icon='close'
              iconComponent={CloseIcon}
              onClick={this.handleDismiss}
              title={this.props.intl.formatMessage(messages.dismiss)}
              className='pwa-install-prompt__close'
            />
          </div>
        </div>
      );
    }

    return (
      <div className='pwa-install-prompt pwa-install-prompt--ios'>
        <div className='pwa-install-prompt__icon'>
          <Icon id='install' icon={ShareIcon} />
        </div>
        <div className='pwa-install-prompt__message'>
          <strong>
            <FormattedMessage
              id='pwa.install_title_ios'
              defaultMessage='Add Kronk to your Home Screen'
            />
          </strong>
          <span>
            <FormattedMessage
              id='pwa.install_message_ios'
              defaultMessage='In Safari, tap Share, then “Add to Home Screen”.'
            />
          </span>
        </div>
        <div className='pwa-install-prompt__actions'>
          <IconButton
            icon='close'
            iconComponent={CloseIcon}
            onClick={this.handleDismiss}
            title={this.props.intl.formatMessage(messages.dismiss)}
            className='pwa-install-prompt__close'
          />
        </div>
      </div>
    );
  }
}

export default injectIntl(PwaInstallPrompt);
