import { PureComponent } from 'react';
import { FormattedMessage } from 'react-intl';
import { IconButton } from './icon_button';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import SmartphoneIcon from '@/material-icons/400-24px/smartphone.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { Icon } from './icon';

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

    // If iOS user is already running from the home screen, don't nag.
    if (platform === 'ios' && isStandalone()) return;

    const storageKey = platform === 'ios' ? IOS_STORAGE_KEY : ANDROID_STORAGE_KEY;
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        return;
      }
    }

    setTimeout(() => {
      this.setState({ show: true, platform });
    }, 2000);
  }

  handleDismiss = () => {
    const { platform } = this.state;
    const storageKey = platform === 'ios' ? IOS_STORAGE_KEY : ANDROID_STORAGE_KEY;
    localStorage.setItem(storageKey, Date.now().toString());
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
              <FormattedMessage id='pwa.install_title' defaultMessage='Get the Kronk App' />
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
                id='pwa.install_message_android'
                defaultMessage='Download the app for the best experience'
              />
            )}
          </span>
        </div>
        <div className='pwa-install-prompt__actions'>
          {!isIos && (
            <a
              href='https://kronk.info/kronk.apk'
              className='pwa-install-prompt__button pwa-install-prompt__button--install'
            >
              <FormattedMessage id='pwa.install_button' defaultMessage='Download' />
            </a>
          )}
          <IconButton
            icon='close'
            iconComponent={CloseIcon}
            onClick={this.handleDismiss}
            title='Dismiss'
            className='pwa-install-prompt__close'
          />
        </div>
      </div>
    );
  }
}

export default PwaInstallPrompt;
