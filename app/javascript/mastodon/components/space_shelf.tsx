import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import { AttachmentPicker } from 'mastodon/components/attachment_picker';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import { konnectSearch } from 'mastodon/hooks/useKonnect';
import { useKorner } from 'mastodon/hooks/useKorner';

// A space a Krew or projekt has turned on, as a section on its page: what
// of that korner is Konnected here, then New (the korner's own composer,
// Konnecting what it makes here) and Add existing (the Konnect picker kept
// to that korner). The Konnect grid, decisions.md 2026-11-08: "a Space has
// New and Add existing".

const messages = defineMessages({
  newThing: { id: 'space_shelf.new', defaultMessage: 'New' },
  addExisting: {
    id: 'space_shelf.add_existing',
    defaultMessage: 'Add existing',
  },
  empty: { id: 'space_shelf.empty', defaultMessage: 'Nothing here yet.' },
});

export const SpaceShelf: React.FC<{
  // The record whose page this is: a Krew or a projekt.
  homeSlug: string;
  homeId: string;
  // The space shown.
  korner: string;
  title: string;
  canAdd: boolean;
  // Hide the whole section while nothing is Konnected (a projekt's albums).
  hideWhenEmpty?: boolean;
  className?: string;
}> = ({
  homeSlug,
  homeId,
  korner,
  title,
  canAdd,
  hideWhenEmpty,
  className,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const manifest = useKorner(korner);
  const { attached, attachedFrom, loading, refresh } = useAttachments(
    homeSlug,
    homeId,
  );
  const [picking, setPicking] = useState(false);

  // Both ways round: whichever end made the link.
  const items = useMemo(
    () =>
      [
        ...attached
          .filter((row) => row.target_slug === korner)
          .map((row) => ({ key: row.id, end: row.target })),
        ...attachedFrom
          .filter((row) => row.source_slug === korner)
          .map((row) => ({ key: row.id, end: row.source })),
      ].filter((item) => !item.end.missing),
    [attached, attachedFrom, korner],
  );

  const makeRoute = manifest?.konnect?.route ?? manifest?.compose?.route;
  const handleNew = useCallback(() => {
    if (!makeRoute) return;
    history.push({
      pathname: makeRoute,
      search: konnectSearch(homeSlug, homeId),
    });
  }, [history, makeRoute, homeSlug, homeId]);
  const openPicker = useCallback(() => {
    setPicking(true);
  }, []);
  const closePicker = useCallback(() => {
    setPicking(false);
  }, []);

  if (hideWhenEmpty && !loading && items.length === 0) return null;

  return (
    <section className={`krew-detail__section space-shelf ${className ?? ''}`}>
      <h3 className='korner-section-heading'>{title}</h3>

      {!loading && items.length === 0 && (
        <p className='krew-detail__section-hint'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {items.length > 0 && (
        <ul className='krew-detail__event-list'>
          {items.map(({ key, end }) => (
            <li key={key}>
              {end.url ? (
                <Link to={end.url} className='krew-detail__event'>
                  <span className='krew-detail__event-title'>{end.title}</span>
                </Link>
              ) : (
                <span className='krew-detail__event'>
                  <span className='krew-detail__event-title'>{end.title}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div className='space-shelf__actions'>
          {makeRoute && (
            <button type='button' className='button' onClick={handleNew}>
              {intl.formatMessage(messages.newThing)}
            </button>
          )}
          <button
            type='button'
            className='button button-secondary'
            onClick={openPicker}
          >
            {intl.formatMessage(messages.addExisting)}
          </button>
        </div>
      )}

      {picking && (
        <AttachmentPicker
          sourceSlug={homeSlug}
          sourceId={homeId}
          onlySlug={korner}
          onClose={closePicker}
          onAttached={refresh}
          exclude={items.map(({ end }) => ({ slug: korner, id: end.id ?? '' }))}
        />
      )}
    </section>
  );
};
