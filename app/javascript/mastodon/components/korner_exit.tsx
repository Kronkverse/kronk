import { useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';

// The exit affordance every Stage-based korner reserves at the top-left.
// One purpose: get back out of the space to the Hub. Content flows
// underneath — the pill is fixed to the Stage's top-left corner and
// content passes below.
//
// Route-aware: on `/hub/*` we return to `/hub`. On any other Stage
// route (e.g. `/nudges` if it ever moves onto Stage) we fall back to
// the browser history so "back" is the right verb. If neither
// applies, the exit is not rendered.

const messages = defineMessages({
  hub: { id: 'korner_exit.hub', defaultMessage: 'Hub' },
});

const HUB_ROUTE_RE = /^\/hub\/[a-z0-9-]+/;

export const KornerExit: React.FC = () => {
  const intl = useIntl();
  const location = useLocation();

  const insideHubKorner = useMemo(
    () => HUB_ROUTE_RE.test(location.pathname),
    [location.pathname],
  );

  if (!insideHubKorner) return null;

  return (
    <Link to='/hub' className='korner-exit' aria-label='Back to Hub'>
      <ArrowBackIcon className='korner-exit__icon' aria-hidden='true' />
      <span className='korner-exit__label'>
        {intl.formatMessage(messages.hub)}
      </span>
    </Link>
  );
};
