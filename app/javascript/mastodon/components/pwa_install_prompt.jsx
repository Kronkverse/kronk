import { PureComponent } from 'react';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';
import { IconButton } from './icon_button';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import SmartphoneIcon from '@/material-icons/400-24px/smartphone.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { Icon } from './icon';

// Android used to be offered the old Kronk APK, which the server now answers
// with "Kronk has moved to the web" (lib/kronk/legacy_app_gate.rb). Until a
// replacement app ships, both platforms are offered the web app on the
// home screen instead.
const messages = defineMessages({
  dismiss: { id: 'pwa.dismiss', defaultMessage: 'Dismiss' },
});

const ANDROID_STORAGE_KEY = 'apk_install_dismissed';
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
  }

  handleDismiss = () => {
    const { platform } = this.state;
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

    const isIos = platform === 'ios';

    return (
      <div className={`pwa-install-prompt pwa-install-prompt--${platform}`}>
        <div className='pwa-install-prompt__icon'>
          <Icon id='install' icon={isIos ? ShareIcon : SmartphoneIcon} />
        </div>
        <div className='pwa-install-prompt__message'>
          <strong>
            {isIos ? (
              <FormattedMessage
                id='pwa.install_title_ios'
                defaultMessage='Add Kronk to your Home Screen'
              />
            ) : (
              <FormattedMessage
                id='pwa.install_title_android'
                defaultMessage='Add Kronk to your home screen'
              />
            )}
          </strong>
          <span>
            {isIos ? (
              <FormattedMessage
                id='pwa.install_message_ios'
                defaultMessage='In Safari, tap Share, then “Add to Home Screen”.'
              />
            ) : (
              <FormattedMessage
                id='pwa.install_message_android_web'
                defaultMessage='In Chrome, open the menu, then “Add to Home screen”.'
              />
            )}
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
