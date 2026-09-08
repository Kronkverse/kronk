import { useCallback } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import type { DragEndEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import {
  apiReorderProfileCards,
  apiUpsertProfileCard,
} from 'mastodon/api/profile_cards';
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

const messages = defineMessages({
  size: {
    id: 'profile_shelves.arrange.size',
    defaultMessage: 'Size: {size}. Tap to change.',
  },
  grabTile: {
    id: 'profile_shelves.arrange.grab_tile',
    defaultMessage: 'Hold to move this tile',
  },
});

const HOLD_MS = 300;
const HOLD_TOLERANCE_PX = 8;

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
  cardType: string;
  size: TileSize;
  // The smallest size this tile can honour. The control offers nothing below
  // it, so a paragraph can't be asked into a 1x1.
  floor: TileSize;
  node: React.ReactNode;
}

// One tile in Arrange: draggable by hold, and sized by tapping through the
// sizes it can honour. Sizing lives on the tile rather than in a menu because
// a size is a thing you judge by looking at it — you want the change under
// your eye, not two taps away.
const SortableTile: React.FC<{
  tile: Tile;
  onResize: (tile: Tile) => void;
}> = ({ tile, onResize }) => {
  const intl = useIntl();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.cardType });

  const handleResize = useCallback(() => {
    onResize(tile);
  }, [onResize, tile]);

  const swallow = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={setNodeRef}
      className={`profile-board__tile profile-board__tile--${tile.size}${isDragging ? ' profile-board__tile--lifted' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={intl.formatMessage(messages.grabTile)}
      {...attributes}
      {...listeners}
    >
      {tile.node}
      <button
        type='button'
        className='profile-board__size'
        onPointerDown={swallow}
        onClick={handleResize}
        aria-label={intl.formatMessage(messages.size, {
          size: tile.size.toUpperCase(),
        })}
      >
        {tile.size.toUpperCase()}
      </button>
    </div>
  );
};

interface ProfileBoardProps {
  accountId: string;
  cards: ApiProfileCardJSON[];
  sections: ApiProfileSectionJSON[];
  // Arrange mode: the same grid, with the tiles draggable and sizeable. The
  // korner half of Arrange lives in ArrangeStack; this is the identity half.
  arrange?: boolean;
  onCardsChange?: (cards: ApiProfileCardJSON[]) => void;
}

export const ProfileBoard: React.FC<ProfileBoardProps> = ({
  accountId,
  cards,
  sections,
  arrange = false,
  onCardsChange,
}) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: HOLD_MS, tolerance: HOLD_TOLERANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Reorder writes card_types, not ids — the endpoint is keyed by slug. Every
  // card the account owns has to travel, not just the ones on screen: a card
  // with an empty body is skipped by the render, and leaving it out would
  // reassign everyone else's position around it and shuffle the grid on the
  // next drag.
  const persistOrder = useCallback(
    (nextTypes: string[]) => {
      const rest = cards
        .map((c) => c.card_type)
        .filter((t) => !nextTypes.includes(t));
      const order = [...nextTypes, ...rest];

      const byType = new Map(cards.map((c) => [c.card_type, c]));
      const nextCards = order
        .map((t) => byType.get(t))
        .filter((c): c is ApiProfileCardJSON => Boolean(c));

      onCardsChange?.(nextCards);
      void apiReorderProfileCards(order).catch(() => {
        onCardsChange?.(cards);
      });
    },
    [cards, onCardsChange],
  );

  const resize = useCallback(
    (tile: Tile) => {
      const card = cards.find((c) => c.card_type === tile.cardType);
      if (!card) return;

      // Cycle through the sizes at or above this tile's floor, wrapping back
      // to the floor at the top.
      const allowed = TILE_SIZES.slice(TILE_SIZES.indexOf(tile.floor));
      const next =
        allowed[(allowed.indexOf(tile.size) + 1) % allowed.length] ??
        tile.floor;

      const updated = {
        ...card,
        settings: { ...card.settings, size: next },
      };
      onCardsChange?.(
        cards.map((c) => (c.card_type === card.card_type ? updated : c)),
      );

      // `settings` replaces the whole jsonb, so the size goes on top of what
      // the card already carries rather than in place of it.
      void apiUpsertProfileCard(card.card_type, {
        settings: updated.settings,
      }).catch(() => {
        onCardsChange?.(cards);
      });
    },
    [cards, onCardsChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const types = cards.map((c) => c.card_type);
      const from = types.indexOf(String(active.id));
      const to = types.indexOf(String(over.id));
      if (from < 0 || to < 0) return;

      const next = [...types];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      persistOrder(next);
    },
    [cards, persistOrder],
  );

  const tiles: Tile[] = [];

  cards.forEach((card) => {
    const def = PROFILE_FIELD_BY_KEY[card.card_type];
    if (!def || card.body.trim().length === 0) return;

    tiles.push({
      key: `field-${card.id}`,
      cardType: card.card_type,
      size: sizeForField(card, def),
      floor: tileSizeFloor(def.answerType),
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
      cardType: card.card_type,
      size: 'l',
      floor: 'l',
      node: <ShelfTold card={card} />,
    });
  });

  if (tiles.length === 0 && sections.length === 0) return null;

  return (
    <>
      {tiles.length > 0 &&
        (arrange ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tiles.map((t) => t.cardType)}
              strategy={rectSortingStrategy}
            >
              <div className='profile-board profile-board--arrange'>
                {tiles.map((tile) => (
                  <SortableTile key={tile.key} tile={tile} onResize={resize} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
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
        ))}

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
