import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';

import type { ProfileFieldDef } from '../profile_field_catalog';
import { PROFILE_FIELD_BY_KEY } from '../profile_field_catalog';

import { isLongText, ProfileFieldBody } from './profile_fields_display';
import { ShelfDrawn } from './shelf_drawn';
import { ShelfTold } from './shelf_told';

// ProfileBoard — the profile as one arrangement of tiles rather than a
// section of fields followed by a list of shelves.
//
// Step 1 of the tile board (docs/spaces/profile.md). A field and a korner
// shelf are now peers on one grid, each sized from what it holds. Nothing is
// draggable yet and no size is stored — this is the read side, which is worth
// doing on its own because it is what turns the page from a list into
// something that looks arranged.
//
// Sizes are the four the design names, in a 4-column grid that becomes 2
// columns in a narrow Stage:
//
//   s   1x1   Pronouns, Location, a link
//   m   2x1   Interests, Values, Skills
//   l   2x2   About me, a photo, an album
//   xl  4x2   a feature — full width at any size
//
// The size is derived from content here. When `settings.size` lands (step 2)
// it overrides this, and this becomes the default for a tile nobody has sized
// yet — so the fallback has to be decent on its own, not a placeholder.

export type TileSize = 's' | 'm' | 'l' | 'xl';

// Korner renders that lead with an image want room; a list of answers or
// listings reads fine at half width.
const IMAGE_LED_RENDERS = new Set(['album', 'photo', 'track', 'trek']);

const sizeForField = (
  card: ApiProfileCardJSON,
  def: ProfileFieldDef,
): TileSize => {
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

const sizeForSection = (section: ApiProfileSectionJSON): TileSize => {
  const render =
    typeof section.settings.render === 'string'
      ? section.settings.render
      : 'korner';

  return IMAGE_LED_RENDERS.has(render) ? 'l' : 'm';
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

  // Order note: fields keep their order, then any legacy told card, then
  // korner shelves — the order the page already had. Cards and sections carry
  // independent `position` sequences today, both starting at 0, so merging on
  // position alone would interleave them arbitrarily and scramble a profile
  // somebody has already arranged. One shared sequence is what makes a true
  // mixed order possible, and it lands with the editing work rather than here.
  cards.forEach((card) => {
    const def = PROFILE_FIELD_BY_KEY[card.card_type];
    if (!def || card.body.trim().length === 0) return;

    tiles.push({
      key: `field-${card.id}`,
      size: sizeForField(card, def),
      node: <ProfileFieldBody card={card} def={def} />,
    });
  });

  cards.forEach((card) => {
    if (PROFILE_FIELD_BY_KEY[card.card_type]) return;

    tiles.push({
      key: `told-${card.id}`,
      size: 'l',
      node: <ShelfTold card={card} />,
    });
  });

  sections.forEach((section) => {
    tiles.push({
      key: `shelf-${section.id}`,
      size: sizeForSection(section),
      node: <ShelfDrawn accountId={accountId} section={section} />,
    });
  });

  if (tiles.length === 0) return null;

  return (
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
  );
};
