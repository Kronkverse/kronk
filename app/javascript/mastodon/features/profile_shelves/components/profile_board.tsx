import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';

import type { ProfileFieldDef } from '../profile_field_catalog';
import { PROFILE_FIELD_BY_KEY } from '../profile_field_catalog';

import { isLongText, ProfileFieldBody } from './profile_fields_display';
import { ShelfDrawn } from './shelf_drawn';
import { ShelfTold } from './shelf_told';

// ProfileBoard — the two zones a profile is made of
// (docs/spaces/profile.md, "The profile board").
//
//   1. Identity — the structured fields, as a grid of sized tiles. Roughly
//      the first screen, under the header.
//   2. The shelf stack — one korner per screen below it, each a full-width
//      band swiped sideways through the work the owner chose to show.
//
// Korner shelves used to be tiles in this same grid, sized s/m/l/xl like a
// field. They are not: a korner worth putting on a profile is worth more than
// a quarter of a row, and a rail of thumbnails inside a half-width tile shows
// the work at a size nobody can see it at. So the size vocabulary now applies
// to fields only, where it genuinely changes the page:
//
//   s   1x1   Pronouns, Location, a link
//   m   2x1   Interests, Values, Skills
//   l   2x2   About me, a photo
//   xl  4x2   a feature — full width at any size
//
// A field's size comes from `settings.size` when the owner has set one, and
// from what the field holds when they haven't — so the fallback has to be
// decent on its own, not a placeholder.

export type TileSize = 's' | 'm' | 'l' | 'xl';

const TILE_SIZES: TileSize[] = ['s', 'm', 'l', 'xl'];

const isTileSize = (value: unknown): value is TileSize =>
  typeof value === 'string' && (TILE_SIZES as string[]).includes(value);

// A size is a request, not a promise. Each tile declares the smallest size it
// can honour, and a stored choice is raised to meet it — a paragraph in a 1x1
// is the bug this design exists to stop, so the board refuses to render one
// even if the stored value asks for it. The Arrange control only offers sizes
// at or above the floor, so this clamp is a backstop rather than the mechanism.
const atLeast = (chosen: TileSize, floor: TileSize): TileSize =>
  TILE_SIZES.indexOf(chosen) < TILE_SIZES.indexOf(floor) ? floor : chosen;

export const tileSizeFloor = (answerType: string): TileSize => {
  switch (answerType) {
    case 'longtext':
      return 'l';
    case 'chips':
      return 'm';
    default:
      return 's';
  }
};

const sizeForField = (
  card: ApiProfileCardJSON,
  def: ProfileFieldDef,
): TileSize => {
  const stored: unknown = card.settings.size;
  if (isTileSize(stored)) {
    return atLeast(stored, tileSizeFloor(def.answerType));
  }

  switch (def.answerType) {
    case 'longtext':
      // A paragraph in a small tile is the bug this design exists to stop.
      return 'l';
    case 'chips':
      return 'm';
    case 'text':
    case 'pair':
    case 'link':
    case 'date':
    default:
      // "Sydney" fits a small tile; a sentence typed into a text field does
      // not, and gets the same treatment the flat grid already gave it.
      return isLongText(card.body) ? 'm' : 's';
  }
};

interface Tile {
  key: string;
  size: TileSize;
  node: React.ReactNode;
}

interface ProfileBoardProps {
  accountId: string;
  cards: ApiProfileCardJSON[];
  sections: ApiProfileSectionJSON[];
}

export const ProfileBoard: React.FC<ProfileBoardProps> = ({
  accountId,
  cards,
  sections,
}) => {
  const tiles: Tile[] = [];

  cards.forEach((card) => {
    const def = PROFILE_FIELD_BY_KEY[card.card_type];
    if (!def || card.body.trim().length === 0) return;

    tiles.push({
      key: `field-${card.id}`,
      size: sizeForField(card, def),
      node: <ProfileFieldBody card={card} def={def} />,
    });
  });

  // Legacy told cards — the free-text About/Interests/Values blocks the
  // structured fields replaced. They sit after the fields, at the size a
  // paragraph needs, until the last of them are converted.
  //
  // An empty one renders nothing. A profile carrying an untouched "Moments"
  // or "At a glance" card was drawing an empty box with a heading in it —
  // the same guard the field tiles above already have.
  cards.forEach((card) => {
    if (PROFILE_FIELD_BY_KEY[card.card_type]) return;
    if (card.body.trim().length === 0) return;

    tiles.push({
      key: `told-${card.id}`,
      size: 'l',
      node: <ShelfTold card={card} />,
    });
  });

  if (tiles.length === 0 && sections.length === 0) return null;

  return (
    <>
      {tiles.length > 0 && (
        <div className='profile-board'>
          {tiles.map((tile) => (
            <div
              key={tile.key}
              className={`profile-board__tile profile-board__tile--${tile.size}`}
            >
              {tile.node}
            </div>
          ))}
        </div>
      )}

      {sections.length > 0 && (
        <div className='profile-shelf-stack'>
          {sections.map((section) => (
            <ShelfDrawn
              key={section.id}
              accountId={accountId}
              section={section}
            />
          ))}
        </div>
      )}
    </>
  );
};
