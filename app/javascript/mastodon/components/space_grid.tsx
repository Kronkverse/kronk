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
// standard, docs/design.md (Card standard)). SpaceCard is now a convenience
// wrapper — it takes the four things a listing has and puts them in the
// standard's slots — rather than a second card implementation. Spaces that
// already call it (Wachuneed, Kalendar events) did not change.
//
// The chip goes in `meta`, not in `badge`. A badge says which korner a card
// came from; a Wachuneed category or Kalendar's LIVE pip is a fact about the
// item, and the contract is that a slot is never re-purposed because it
// happens to look right.

// `layout`: `grid` (the default) is the square tiles above. `masonry` keeps
// each image's own shape and stacks the tiles in columns, the way work hangs
// on a gallery wall: for a collection whose images ARE the thing (an artist's
// portfolio), where cropping a tall painting or a wide panorama to a square
// would cut the work. Same cards, same slots; only the media's shape and the
// arrangement change.
//
// `row` is one line of the same tiles that scrolls sideways, the next tile
// peeking in at the edge: for a shelf among others down a page, like the
// Booth's By artist and By kind (2026-10-29).
//
// `wide` makes every tile about half as wide again, with a landscape image:
// for things that hold other things, so a row of them reads as a different
// shape from the items below (Wachuneed's shops, 2026-11-16). In the grid a
// wide tile takes two columns.
interface SpaceGridProps {
  children: React.ReactNode;
  className?: string;
  layout?: 'grid' | 'masonry' | 'row';
  wide?: boolean;
}

export const SpaceGrid: React.FC<SpaceGridProps> = ({
  children,
  className,
  layout = 'grid',
  wide = false,
}) => (
  <ul
    className={[
      'space-grid',
      layout === 'grid' ? null : `space-grid--${layout}`,
      wide ? 'space-grid--wide' : null,
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </ul>
);

interface SpaceCardProps {
  // Where tapping the card goes. Omit for a card that isn't a link.
  to?: string;
  // An address outside Kronk to open instead, in a new tab: the card is
  // then a plain link (a Kollection app opens the app itself). Wins over
  // `to`.
  href?: string | null;
  // A line under the card, outside its link, for a second way in (a
  // Kollection app's About). Keep it to one small link.
  after?: React.ReactNode;
  image?: string | null;
  // Several pictures instead of one: the first large, the next two stacked
  // beside it, for a card that stands for a collection. Fewer than two falls
  // back to `image`.
  images?: string[];
  // A round picture of whose it is, over the image's lower edge.
  avatar?: string | null;
  // `accent` fills the card with Kronk purple, for a card that is a
  // different kind of thing from the tiles around it (a shop among listings).
  tone?: 'accent';
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
  href,
  after,
  image,
  images,
  avatar,
  tone,
  placeholder,
  title,
  meta,
  tag,
  tagKind,
}) => {
  const pictures = [...new Set(images)];
  const mosaic = pictures.length > 1 ? pictures.slice(0, 3) : null;
  const cover = mosaic ? null : (image ?? pictures[0]);

  return (
    // The <li> is the grid cell and the card is what sits in it, so the card
    // can be a link without the list losing its semantics.
    <li
      className={
        after ? 'space-grid__cell space-grid__cell--after' : 'space-grid__cell'
      }
    >
      <StandardCard
        as={href ? 'a' : to ? Link : 'div'}
        to={href ? undefined : to}
        {...(href ? { href, target: '_blank', rel: 'noopener' } : {})}
        variant='grid'
        className={tone ? `space-card space-card--${tone}` : 'space-card'}
      >
        <CardMedia
          className={[
            mosaic ? 'space-card__mosaic' : null,
            mosaic || cover ? null : 'space-card__photo--placeholder',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {mosaic ? (
            mosaic.map((src) => <img key={src} src={src} alt='' />)
          ) : cover ? (
            <img src={cover} alt='' />
          ) : (
            <span aria-hidden='true'>{placeholder}</span>
          )}
          {avatar && (
            <span className='space-card__avatar'>
              <img src={avatar} alt='' />
            </span>
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
      {after && <div className='space-card__after'>{after}</div>}
    </li>
  );
};
