import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import VisibilityIcon from '@/material-icons/400-24px/visibility.svg?react';
import { apiRequestGet } from 'mastodon/api';

const messages = defineMessages({
  label: {
    id: 'moments.viewer.views_label',
    defaultMessage:
      '{count, plural, =0 {No one has seen this yet} one {Seen by # person} other {Seen by # people}}',
  },
});

interface ViewJSON {
  viewed_at: string;
  account: {
    id: string;
    acct: string;
    display_name: string;
    avatar_static: string;
  };
}

// "Seen by N" on your own Moment, and who (docs/spaces/moments.md, Views).
// The list loads when opened; the count comes with the Moment.
export const MomentViews: React.FC<{ momentId: string; count: number }> = ({
  momentId,
  count,
}) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<ViewJSON[] | null>(null);

  useEffect(() => {
    setOpen(false);
    setViews(null);
  }, [momentId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiRequestGet<ViewJSON[]>(`v1/moments/${momentId}/views`)
      .then((list) => {
        if (!cancelled) setViews(list);
      })
      .catch(() => {
        if (!cancelled) setViews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, momentId]);

  const toggle = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  // The list is fresher than the count that came with the Moment.
  const shown = views ? Math.max(views.length, count) : count;
  const label = intl.formatMessage(messages.label, { count: shown });

  return (
    <div className='moments-viewer__views'>
      <button
        type='button'
        className='moments-viewer__action'
        onClick={toggle}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <VisibilityIcon />
        <span className='moments-viewer__action-count'>{shown}</span>
      </button>
      {open && (
        <div
          className='moments-viewer__views-panel'
          role='dialog'
          aria-label={label}
        >
          <p className='moments-viewer__views-title'>{label}</p>
          {views === null ? (
            <p className='moments-viewer__views-note'>
              <FormattedMessage
                id='moments.viewer.views_loading'
                defaultMessage='Loading…'
              />
            </p>
          ) : (
            views.length > 0 && (
              <ul className='moments-viewer__views-list'>
                {views.map((v) => (
                  <li key={v.account.id} className='moments-viewer__views-row'>
                    <Link
                      to={`/@${v.account.acct}`}
                      className='moments-viewer__views-who'
                    >
                      <img
                        src={v.account.avatar_static}
                        alt=''
                        className='moments-viewer__views-avatar'
                      />
                      <span className='moments-viewer__views-name'>
                        {v.account.display_name || v.account.acct}
                      </span>
                    </Link>
                    <time
                      className='moments-viewer__views-when'
                      dateTime={v.viewed_at}
                    >
                      {intl.formatTime(v.viewed_at, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
};
