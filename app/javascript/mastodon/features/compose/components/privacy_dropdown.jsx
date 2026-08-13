import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { injectIntl, defineMessages } from 'react-intl';

import classNames from 'classnames';

import Overlay from 'react-overlays/Overlay';

import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import OrbitIcon from '@/material-icons/400-24px/orbit.svg?react';
import ZheIcon from '@/material-icons/400-24px/zhe.svg?react';
import { DropdownSelector } from 'mastodon/components/dropdown_selector';
import { Icon }  from 'mastodon/components/icon';

// Kronk reach ladder (docs/kronk_feed_and_reach.md — Kronkverse /
// Orbit / Mates / Just-me), rendered here as the classic privacy-
// dropdown widget still consumed by BoostModal. The primary compose
// audience picker is <ComposeReachDropdown>, which already offers
// only the Kronk-native tiers; this dropdown was the last surface
// still exposing the Mastodon primitives (unlisted / private /
// direct) — retired in Phase 1B (2026-08-12) as part of the Path B
// visibility rollout.
//
// Values arriving from the DB / boost target that still carry a
// retired visibility (unlisted / private / direct / limited) are
// display-aliased to the closest Kronk-native tier so the dropdown
// never renders empty — see `resolveValueOption` below.

export const messages = defineMessages({
  kronkverse_short: { id: 'privacy.kronkverse.short', defaultMessage: 'Kronkverse' },
  kronkverse_long: { id: 'privacy.kronkverse.long', defaultMessage: 'Everyone on Kronk' },
  orbit_short: { id: 'privacy.orbit.short', defaultMessage: 'Orbit' },
  orbit_long: { id: 'privacy.orbit.long', defaultMessage: 'Your Mates and their Mates' },
  mates_short: { id: 'privacy.mates.short', defaultMessage: 'Mates' },
  mates_long: { id: 'privacy.mates.long', defaultMessage: 'Only your Mates (mutual connections)' },
  self_only_short: { id: 'privacy.self_only.short', defaultMessage: 'Just me' },
  self_only_long: { id: 'privacy.self_only.long', defaultMessage: 'On your own timeline only — no one else sees it' },
  change_privacy: { id: 'privacy.change', defaultMessage: 'Change post privacy' },
});

// Retired Mastodon-primitive values still land here from legacy DB
// rows or boost targets whose author's default_privacy hasn't
// migrated; alias each to the closest Kronk-native tier for display.
// Matches the alias table in components/visibility_icon.tsx.
const LEGACY_VALUE_ALIAS = {
  unlisted: 'self_only',
  private: 'mates',
  direct: 'mates',
  limited: 'mates',
};

class PrivacyDropdown extends PureComponent {

  static propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    container: PropTypes.func,
    disabled: PropTypes.bool,
    intl: PropTypes.object.isRequired,
  };

  state = {
    open: false,
    placement: 'bottom',
  };

  handleToggle = () => {
    if (this.state.open && this.activeElement) {
      this.activeElement.focus({ preventScroll: true });
    }

    this.setState({ open: !this.state.open });
  };

  handleKeyDown = e => {
    switch(e.key) {
    case 'Escape':
      this.handleClose();
      break;
    }
  };

  handleMouseDown = () => {
    if (!this.state.open) {
      this.activeElement = document.activeElement;
    }
  };

  handleButtonKeyDown = (e) => {
    switch(e.key) {
    case ' ':
    case 'Enter':
      this.handleMouseDown();
      break;
    }
  };

  handleClose = () => {
    if (this.state.open && this.activeElement) {
      this.activeElement.focus({ preventScroll: true });
    }
    this.setState({ open: false });
  };

  handleChange = value => {
    this.props.onChange(value);
  };

  UNSAFE_componentWillMount () {
    const { intl: { formatMessage } } = this.props;

    // Kronk reach ladder, widest → narrowest.
    this.options = [
      { icon: 'zhe', iconComponent: ZheIcon, value: 'public', text: formatMessage(messages.kronkverse_short), meta: formatMessage(messages.kronkverse_long) },
      { icon: 'orbit', iconComponent: OrbitIcon, value: 'orbit', text: formatMessage(messages.orbit_short), meta: formatMessage(messages.orbit_long) },
      { icon: 'group', iconComponent: GroupIcon, value: 'mates', text: formatMessage(messages.mates_short), meta: formatMessage(messages.mates_long) },
      { icon: 'lock', iconComponent: LockIcon, value: 'self_only', text: formatMessage(messages.self_only_short), meta: formatMessage(messages.self_only_long) },
    ];
  }

  setTargetRef = c => {
    this.target = c;
  };

  findTarget = () => {
    return this.target;
  };

  handleOverlayEnter = (state) => {
    this.setState({ placement: state.placement });
  };

  render () {
    const { value, container, disabled, intl } = this.props;
    const { open, placement } = this.state;

    // Legacy Mastodon-primitive values still hit us from BoostModal
    // when the caller's default_privacy hasn't been migrated yet
    // (Phase 2 lands the DB fold). Alias to the nearest Kronk-native
    // tier so the dropdown always has a valid selected option.
    const resolvedValue = LEGACY_VALUE_ALIAS[value] ?? value;
    const valueOption = this.options.find(item => item.value === resolvedValue) ?? this.options[0];

    return (
      <div ref={this.setTargetRef} onKeyDown={this.handleKeyDown}>
        <button
          type='button'
          title={intl.formatMessage(messages.change_privacy)}
          aria-expanded={open}
          onClick={this.handleToggle}
          onMouseDown={this.handleMouseDown}
          onKeyDown={this.handleButtonKeyDown}
          disabled={disabled}
          className={classNames('dropdown-button', { active: open })}
        >
          <Icon id={valueOption.icon} icon={valueOption.iconComponent} />
          <span className='dropdown-button__label'>{valueOption.text}</span>
        </button>

        <Overlay show={open} offset={[5, 5]} placement={placement} flip target={this.findTarget} container={container} popperConfig={{ strategy: 'fixed', onFirstUpdate: this.handleOverlayEnter }}>
          {({ props, placement }) => (
            <div {...props}>
              <div className={`dropdown-animation privacy-dropdown__dropdown ${placement}`}>
                <DropdownSelector
                  items={this.options}
                  value={resolvedValue}
                  onClose={this.handleClose}
                  onChange={this.handleChange}
                />
              </div>
            </div>
          )}
        </Overlay>
      </div>
    );
  }

}

export default injectIntl(PrivacyDropdown);
