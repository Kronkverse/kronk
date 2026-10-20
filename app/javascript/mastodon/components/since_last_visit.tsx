import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import { setKornerSinceLastVisit } from 'mastodon/actions/korners';
import { StatusQuoteManager } from 'mastodon/components/status_quoted';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useAppDispatch } from 'mastodon/store';

// SinceLastVisit — "since you were last here", under the Frame's header on a
// korner's landing and views (docs/spaces/hub.md, Updates).
//
// Opening a korner clears its badge (markKornerSeen), and the server answers
// with what that cleared: how many updates, and the newest of them as posts.
// This shows them as the same cards the feed draws, so the number on the
// tile always leads somewhere. It stays while you move between the korner's
// views and goes when you hide it. Nothing new, nothing shown.
//
// Same route scoping as <AutoSpaceHeader>: a korner's landing or one of its
// declared views, never a detail page or settings.

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/;

// Cards shown before "Show all".
const FIRST = 3;

const messages = defineMessages({
  title: {
    id: 'since_last_visit.title',
    defaultMessage: 'Since you were last here',
  },
  count: {
    id: 'since_last_visit.count',
    defaultMessage: '{count} new',
  },
  hide: { id: 'since_last_visit.hide', defaultMessage: 'Hide' },
  showAll: {
    id: 'since_last_visit.show_all',
    defaultMessage: 'Show all {count}',
  },
  older: {
    id: 'since_last_visit.older',
    defaultMessage: '{count} more, further down in {korner}',
  },
});

export const SinceLastVisit: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);

  const match = HUB_ROUTE_RE.exec(pathname);
  const slug = match?.[1];
  const segment = match?.[2];
  const korner = useKorner(slug);
  const since = korner?.since_last_visit;

  const handleHide = useCallback(() => {
    if (slug) dispatch(setKornerSinceLastVisit({ slug, since: null }));
  }, [dispatch, slug]);

  const handleShowAll = useCallback(() => {
    setExpanded(true);
  }, []);

  if (!slug || !korner || korner.core || !since || since.count === 0)
    return null;
  if (segment && !(korner.views ?? []).some((view) => view.key === segment))
    return null;

  const shown = expanded ? since.status_ids : since.status_ids.slice(0, FIRST);
  const hiddenLoaded = since.status_ids.length - shown.length;
  const older = since.count - since.status_ids.length;

  return (
    <section
      className='since-last-visit'
      aria-label={intl.formatMessage(messages.title)}
    >
      <div className='since-last-visit__head'>
        <h2 className='since-last-visit__title'>
          {intl.formatMessage(messages.title)}
        </h2>
        <span className='since-last-visit__count'>
          {intl.formatMessage(messages.count, { count: since.count })}
        </span>
        <button
          type='button'
          className='since-last-visit__hide'
          onClick={handleHide}
        >
          {intl.formatMessage(messages.hide)}
        </button>
      </div>

      <div className='since-last-visit__items'>
        {shown.map((id) => (
          <StatusQuoteManager key={id} id={id} contextType='home' />
        ))}
      </div>

      {hiddenLoaded > 0 && (
        <button
          type='button'
          className='since-last-visit__more'
          onClick={handleShowAll}
        >
          {intl.formatMessage(messages.showAll, {
            count: since.status_ids.length,
          })}
        </button>
      )}

      {older > 0 && (expanded || hiddenLoaded === 0) && (
        <p className='since-last-visit__older'>
          {intl.formatMessage(messages.older, {
            count: older,
            korner: korner.name,
          })}
        </p>
      )}
    </section>
  );
};
