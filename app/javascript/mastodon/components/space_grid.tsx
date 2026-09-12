import { Link } from 'react-router-dom';

import {
  StandardCard,
  CardMedia,
  CardTitle,
  CardMeta,
} from 'mastodon/components/standard_card';

// SpaceGrid — the standard way a Kronk space lists things.
//
// Wachuneed shipped a listings grid on 2026-09-07 and it turned out to be the
// right shape for any space that shows a collection of made things: two up on
// a phone, four from tablet width, each item a square image over a short body.
// Rather than every korner re-deriving that, it lives here once and spaces
// pass their content in.
//
// The grid is deliberately a fixed column count rather than an auto-fill:
// "two wide on a phone, four wide on a desktop" is a decision about how much
// of one thing you want to see, and auto-fill would make it a function of
// whatever the viewport happens to be.
//
// A card is: an image (or a placeholder glyph so a missing image never
// collapses the tile), a title, an optional meta line, and an optional chip.
// Anything a space needs beyond that belongs in the space, not in here — the
// point of a standard card is that it stays the same across the site.
//
// The tile is <StandardCard variant='grid'> as of 2026-09-12 (the card
// standard, docs/kronk_card_standard.md). SpaceCard is now a convenience
// wrapper — it takes the four things a listing has and puts them in the
// standard's slots — rather than a second card implementation. Spaces that
// already call it (Wachuneed, Kalendar events) did not change.
//
// The chip goes in `meta`, not in `badge`. A badge says which korner a card
// came from; a Wachuneed category or Kalendar's LIVE pip is a fact about the
// item, and the contract is that a slot is never re-purposed because it
// happens to look right.

interface SpaceGridProps {
  children: React.ReactNode;
  className?: string;
}

export const SpaceGrid: React.FC<SpaceGridProps> = ({
  children,
  className,
}) => (
  <ul className={className ? `space-grid ${className}` : 'space-grid'}>
    {children}
  </ul>
);

interface SpaceCardProps {
  // Where tapping the card goes. Omit for a card that isn't a link.
  to?: string;
  image?: string | null;
  // Shown when there is no image — a glyph or emoji that hints at the kind of
  // thing this is. The tile keeps its square either way, so a grid of
  // image-less items still lines up.
  placeholder?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  tag?: React.ReactNode;
  // Modifier suffix for the chip, so a space can colour its own categories
  // without inventing its own card.
  tagKind?: string;
}

export const SpaceCard: React.FC<SpaceCardProps> = ({
  to,
  image,
  placeholder,
  title,
  meta,
  tag,
  tagKind,
}) => (
  // The <li> is the grid cell and the card is what sits in it, so the card
  // can be a link without the list losing its semantics.
  <li className='space-grid__cell'>
    <StandardCard
      as={to ? Link : 'div'}
      to={to}
      variant='grid'
      className='space-card'
    >
      <CardMedia
        className={image ? undefined : 'space-card__photo--placeholder'}
      >
        {image ? (
          <img src={image} alt='' />
        ) : (
          <span aria-hidden='true'>{placeholder}</span>
        )}
      </CardMedia>

      <CardTitle className='space-card__title'>{title}</CardTitle>

      {(meta ?? tag) ? (
        <CardMeta className='space-card__meta'>
          {meta && <span className='space-card__meta-text'>{meta}</span>}
          {tag && (
            <span
              className={
                tagKind
                  ? `space-card__tag space-card__tag--${tagKind}`
                  : 'space-card__tag'
              }
            >
              {tag}
            </span>
          )}
        </CardMeta>
      ) : null}
    </StandardCard>
  </li>
);
