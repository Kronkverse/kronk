import { useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

interface ExpiryCountdownProps {
  expiresAt: string; // ISO8601
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Ticks at a cadence appropriate to the remaining time — every second
// under a minute, every 15s under an hour, every minute above. Keeps
// the header from becoming a per-second re-render loop for
// conversations expiring days from now.
const tickInterval = (remainingMs: number): number => {
  if (remainingMs < MINUTE) return SECOND;
  if (remainingMs < HOUR) return 15 * SECOND;
  return MINUTE;
};

// Format "in Xd Xh" / "in Xh Xm" / "in Xm Xs" / "in Xs" / "expired".
const format = (remainingMs: number) => {
  if (remainingMs <= 0) {
    return (
      <FormattedMessage id='nudges.expiry.expired' defaultMessage='Expired' />
    );
  }

  if (remainingMs >= DAY) {
    const days = Math.floor(remainingMs / DAY);
    const hours = Math.floor((remainingMs % DAY) / HOUR);
    return (
      <FormattedMessage
        id='nudges.expiry.days_hours'
        defaultMessage='Expires in {d}d {h}h'
        values={{ d: days, h: hours }}
      />
    );
  }
  if (remainingMs >= HOUR) {
    const hours = Math.floor(remainingMs / HOUR);
    const minutes = Math.floor((remainingMs % HOUR) / MINUTE);
    return (
      <FormattedMessage
        id='nudges.expiry.hours_minutes'
        defaultMessage='Expires in {h}h {m}m'
        values={{ h: hours, m: minutes }}
      />
    );
  }
  if (remainingMs >= MINUTE) {
    const minutes = Math.floor(remainingMs / MINUTE);
    return (
      <FormattedMessage
        id='nudges.expiry.minutes'
        defaultMessage='Expires in {m}m'
        values={{ m: minutes }}
      />
    );
  }
  const seconds = Math.floor(remainingMs / SECOND);
  return (
    <FormattedMessage
      id='nudges.expiry.seconds'
      defaultMessage='Expires in {s}s'
      values={{ s: seconds }}
    />
  );
};

export const ExpiryCountdown: React.FC<ExpiryCountdownProps> = ({
  expiresAt,
}) => {
  const target = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const remaining = target - now;
    if (remaining <= 0) return () => undefined;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, tickInterval(remaining));
    return () => {
      window.clearInterval(interval);
    };
  }, [target, now]);

  const remaining = target - now;
  const expired = remaining <= 0;

  return (
    <span
      className={`nudges-expiry ${expired ? 'nudges-expiry--expired' : ''}`}
      role='status'
    >
      {format(remaining)}
    </span>
  );
};
