import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import LinkIcon from '@/material-icons/400-24px/link.svg?react';
import { AttachmentPicker } from 'mastodon/components/attachment_picker';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import {
  CardMedia,
  CardMeta,
  CardTitle,
  StandardCard,
} from 'mastodon/components/standard_card';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import { konnectSearch } from 'mastodon/hooks/useKonnect';
import { useKorner } from 'mastodon/hooks/useKorner';

// A space a Krew or projekt has turned on, as its own section on the page:
// a row of cards that scrolls sideways, one for each thing in it, then New
// (the korner's own composer, Konnecting what it makes here) and Add
// existing (the Konnect picker kept to that korner) as the last two cards
// (Tal, 2026-11-08: "when a space is konnected, it should have its own
// section in the krew page, and in it, a similar layout of horizontal
// cards"). The Konnect grid, decisions.md 2026-11-08: "a Space has New and
// Add existing".
//
// By default the cards are what of that korner is Konnected here. A space
// with a list of its own (a Krew's albums and events, which also count
// what was shared to the Krew from a composer) passes `cards` instead.

const messages = defineMessages({
  newThing: { id: 'space_shelf.new', defaultMessage: 'New' },
  newBody: {
    id: 'space_shelf.new_body',
    defaultMessage: 'Make one here',
  },
  addExisting: {
    id: 'space_shelf.add_existing',
    defaultMessage: 'Add existing',
  },
  addBody: {
    id: 'space_shelf.add_existing_body',
    defaultMessage: 'Konnect one you made',
  },
  empty: { id: 'space_shelf.empty', defaultMessage: 'Nothing here yet.' },
});

export interface ShelfCard {
  key: string;
  // The record's id in this korner, so Add existing doesn't offer it again.
  id: string;
  to?: string;
  image?: string | null;
  title: string;
  meta?: string;
}

const ActionCard: React.FC<{
  glyph: React.ReactNode;
  label: string;
  body: string;
  onClick: () => void;
}> = ({ glyph, label, body, onClick }) => (
  <li className='space-grid__cell'>
    <StandardCard
      as='button'
      variant='grid'
      className='space-card space-shelf__action'
      onClick={onClick}
    >
      <CardMedia className='space-shelf__face'>
        <span className='space-shelf__glyph' aria-hidden='true'>
          {glyph}
        </span>
      </CardMedia>
      <CardTitle className='space-card__title'>{label}</CardTitle>
      <CardMeta className='space-card__meta'>
        <span className='space-card__meta-text'>{body}</span>
      </CardMeta>
    </StandardCard>
  </li>
);

export const SpaceShelf: React.FC<{
  // The record whose page this is: a Krew or a projekt.
  homeSlug: string;
  homeId: string;
  // The space shown.
  korner: string;
  title: string;
  canAdd: boolean;
  // The section's anchor, for the Spaces tile that scrolls to it.
  id?: string;
  // The space's own list, when it has one; null while it loads.
  cards?: ShelfCard[] | null;
  // Where New goes, when not the korner's composer with `?konnect=`.
  newSearch?: string;
  // Something was added through Add existing: reload `cards`.
  onAdded?: () => void;
  // Hide the whole section while nothing is Konnected (a projekt's albums).
  hideWhenEmpty?: boolean;
  className?: string;
}> = ({
  homeSlug,
  homeId,
  korner,
  title,
  canAdd,
  id,
  cards,
  newSearch,
  onAdded,
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
  const konnected = useMemo<ShelfCard[]>(
    () =>
      [
        ...attached
          .filter((row) => row.target_slug === korner)
          .map((row) => ({ key: row.id, end: row.target })),
        ...attachedFrom
          .filter((row) => row.source_slug === korner)
          .map((row) => ({ key: row.id, end: row.source })),
      ]
        .filter((item) => !item.end.missing)
        .map(({ key, end }) => ({
          key,
          id: end.id ?? '',
          to: end.url ?? undefined,
          image: end.preview?.image ?? end.preview?.photos?.[0] ?? null,
          title: end.title ?? '',
        })),
    [attached, attachedFrom, korner],
  );
  const shown = cards === undefined ? konnected : cards;
  const settled = cards === undefined ? !loading : cards !== null;

  const makeRoute = manifest?.konnect?.route ?? manifest?.compose?.route;
  const handleNew = useCallback(() => {
    if (!makeRoute) return;
    history.push({
      pathname: makeRoute,
      search: newSearch ?? konnectSearch(homeSlug, homeId),
    });
  }, [history, makeRoute, newSearch, homeSlug, homeId]);
  const openPicker = useCallback(() => {
    setPicking(true);
  }, []);
  const closePicker = useCallback(() => {
    setPicking(false);
  }, []);
  const handleAttached = useCallback(() => {
    refresh();
    onAdded?.();
  }, [refresh, onAdded]);

  const items = shown ?? [];
  if (hideWhenEmpty && settled && items.length === 0) return null;

  return (
    <section
      id={id}
      className={`krew-detail__section space-shelf ${className ?? ''}`}
    >
      <h3 className='korner-section-heading'>{title}</h3>

      {settled && items.length === 0 && !canAdd && (
        <p className='krew-detail__section-hint'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {(items.length > 0 || canAdd) && (
        <SpaceGrid layout='row' className='space-shelf__row'>
          {items.map((card) => (
            <SpaceCard
              key={card.key}
              to={card.to}
              image={card.image}
              placeholder={title.slice(0, 1)}
              title={card.title}
              meta={card.meta}
            />
          ))}
          {canAdd && makeRoute && (
            <ActionCard
              glyph={<Icon id='add' icon={AddIcon} />}
              label={intl.formatMessage(messages.newThing)}
              body={intl.formatMessage(messages.newBody)}
              onClick={handleNew}
            />
          )}
          {canAdd && (
            <ActionCard
              glyph={<Icon id='link' icon={LinkIcon} />}
              label={intl.formatMessage(messages.addExisting)}
              body={intl.formatMessage(messages.addBody)}
              onClick={openPicker}
            />
          )}
        </SpaceGrid>
      )}

      {picking && (
        <AttachmentPicker
          sourceSlug={homeSlug}
          sourceId={homeId}
          onlySlug={korner}
          onClose={closePicker}
          onAttached={handleAttached}
          exclude={items.map((card) => ({ slug: korner, id: card.id }))}
        />
      )}
    </section>
  );
};
