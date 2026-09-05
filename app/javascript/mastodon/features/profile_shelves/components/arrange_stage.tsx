import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import {
  apiDeleteProfileCard,
  apiReorderProfileCards,
  apiUpsertProfileCard,
} from 'mastodon/api/profile_cards';
import type { ApiProfileLibraryJSON } from 'mastodon/api/profile_library';
import { apiGetProfileLibrary } from 'mastodon/api/profile_library';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import {
  apiCreateProfileSection,
  apiDeleteProfileSection,
  apiReorderProfileSections,
  apiUpdateProfileSection,
} from 'mastodon/api/profile_sections';

import { PROFILE_FIELD_BY_KEY } from '../profile_field_catalog';

import type { OrderMode, Reach } from './arrange_slab';
import {
  ArrangeSlab,
  ORDER_ORDER,
  REACH_ORDER,
  SIZE_ORDER,
} from './arrange_slab';
import { LibraryGrid } from './library_grid';
import { PostPicker } from './post_picker';
import type { TileSize } from './profile_board';
import { tileSizeFloor } from './profile_board';
import { TellComposer } from './tell_composer';

// The owner's arrange surface. Renders a slab per shelf (cards +
// sections combined into one owner-facing list) with grip / reach /
// order / visible controls, plus the Library grid underneath.
//
// State is owned locally: mutations optimistically update the local
// arrays, fire the REST call, and roll back on failure. The parent
// gets a callback so the read-side view can refresh when the owner
// switches back to view mode.
//
// The `chosen` order state carries an implicit assumption: the shelf
// has a curated `settings.order_ids` list somewhere. This surface
// only cycles the order MODE — populating order_ids belongs on the
// per-shelf post picker (follow-up PR).

const messages = defineMessages({
  kicker: {
    id: 'profile_shelves.arrange.kicker',
    defaultMessage: 'Profile · arrange',
  },
  title: {
    id: 'profile_shelves.arrange.title',
    defaultMessage: "What's on your profile, and in what order",
  },
  lede: {
    id: 'profile_shelves.arrange.lede',
    defaultMessage:
      'Everything here is off until you turn it on, and every shelf carries its own reach. Shelves drawn from your posts never copy them — turn a shelf off and nothing is deleted, it just stops being shown.',
  },
  cardAbout: {
    id: 'profile_shelves.card_type.about',
    defaultMessage: 'About',
  },
});

const CARD_TITLE: Record<string, string> = {
  about: 'About',
  interests: 'Interests',
  values: 'Values',
  exploring: 'Currently exploring',
  personality: 'Personality',
  drive: 'What drives me',
  rotation: 'In rotation',
  moments: 'Moments',
  note: 'Note',
  highlights: 'Highlights',
  at_a_glance: 'At a glance',
  open_to: 'Open to',
  where_i_am: 'Where I am',
  pod_credentials: 'Pod credentials',
};

const KORNER_SOURCE: Record<string, string> = {
  albutts: 'Albutts',
  booth: 'The Booth',
  map: 'Map',
  wachuneed: 'Wachuneed',
  kuestions: 'Kuestions',
  moments: 'Moments',
};

const KORNER_RENDER: Record<string, string> = {
  albutts: 'album',
  booth: 'track',
  map: 'trek',
  wachuneed: 'listing',
  kuestions: 'answers',
  moments: 'moment',
};

const next = <T,>(list: readonly [T, ...T[]], current: T): T => {
  const i = list.indexOf(current);
  return list[(i + 1) % list.length] ?? list[0];
};

interface ArrangeStageProps {
  cards: ApiProfileCardJSON[];
  sections: ApiProfileSectionJSON[];
  ownerAccountId: string;
  onChange: (next: {
    cards: ApiProfileCardJSON[];
    sections: ApiProfileSectionJSON[];
  }) => void;
}

export const ArrangeStage: React.FC<ArrangeStageProps> = ({
  cards: initialCards,
  sections: initialSections,
  ownerAccountId,
  onChange,
}) => {
  const intl = useIntl();

  const [cards, setCards] = useState(initialCards);
  const [sections, setSections] = useState(initialSections);
  const [library, setLibrary] = useState<ApiProfileLibraryJSON | null>(null);
  const [composing, setComposing] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    key: string;
    family: 'told' | 'drawn';
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    key: string;
    pos: 'above' | 'below';
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiGetProfileLibrary()
      .then((data) => {
        if (!cancelled) setLibrary(data);
      })
      .catch(() => {
        if (!cancelled) setLibrary({ told: [], drawn: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [cards, sections]);

  const publish = useCallback(
    (
      nextCards: ApiProfileCardJSON[],
      nextSections: ApiProfileSectionJSON[],
    ) => {
      setCards(nextCards);
      setSections(nextSections);
      onChange({ cards: nextCards, sections: nextSections });
    },
    [onChange],
  );

  // ── Cards ───────────────────────────────────────────────────────
  const moveCard = useCallback(
    (cardType: string, delta: 1 | -1) => {
      const idx = cards.findIndex((c) => c.card_type === cardType);
      if (idx < 0) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= cards.length) return;
      const nextCards = [...cards];
      const [moved] = nextCards.splice(idx, 1);
      if (!moved) return;
      nextCards.splice(targetIdx, 0, moved);
      publish(nextCards, sections);
      void apiReorderProfileCards(nextCards.map((c) => c.card_type)).catch(
        () => {
          setCards(cards);
        },
      );
    },
    [cards, publish, sections],
  );

  const toggleCardVisible = useCallback(
    (cardType: string) => {
      const card = cards.find((c) => c.card_type === cardType);
      if (!card) return;
      const nextCard = { ...card, visible: !card.visible };
      const nextCards = cards.map((c) =>
        c.card_type === cardType ? nextCard : c,
      );
      publish(nextCards, sections);
      void apiUpsertProfileCard(cardType, { visible: nextCard.visible }).catch(
        () => {
          setCards(cards);
        },
      );
    },
    [cards, publish, sections],
  );

  const cycleCardReach = useCallback(
    (cardType: string) => {
      const card = cards.find((c) => c.card_type === cardType);
      if (!card) return;
      const nextReach = next(REACH_ORDER, card.visibility);
      const nextCard = { ...card, visibility: nextReach };
      publish(
        cards.map((c) => (c.card_type === cardType ? nextCard : c)),
        sections,
      );
      void apiUpsertProfileCard(cardType, { visibility: nextReach }).catch(
        () => {
          setCards(cards);
        },
      );
    },
    [cards, publish, sections],
  );

  const removeCard = useCallback(
    (cardType: string) => {
      publish(
        cards.filter((c) => c.card_type !== cardType),
        sections,
      );
      void apiDeleteProfileCard(cardType).catch(() => {
        setCards(cards);
      });
    },
    [cards, publish, sections],
  );

  const moveCardUp = useCallback(
    (key: string) => {
      moveCard(key, -1);
    },
    [moveCard],
  );
  const moveCardDown = useCallback(
    (key: string) => {
      moveCard(key, 1);
    },
    [moveCard],
  );

  // ── Sections ────────────────────────────────────────────────────
  const moveSection = useCallback(
    (id: string, delta: 1 | -1) => {
      const idx = sections.findIndex((s) => s.id === id);
      if (idx < 0) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= sections.length) return;
      const nextSections = [...sections];
      const [moved] = nextSections.splice(idx, 1);
      if (!moved) return;
      nextSections.splice(targetIdx, 0, moved);
      publish(cards, nextSections);
      void apiReorderProfileSections(nextSections.map((s) => s.id)).catch(
        () => {
          setSections(sections);
        },
      );
    },
    [cards, publish, sections],
  );

  const toggleSectionVisible = useCallback(
    (id: string) => {
      const section = sections.find((s) => s.id === id);
      if (!section) return;
      const nextSection = { ...section, visible: !section.visible };
      publish(
        cards,
        sections.map((s) => (s.id === id ? nextSection : s)),
      );
      void apiUpdateProfileSection(id, {
        visible: nextSection.visible,
      }).catch(() => {
        setSections(sections);
      });
    },
    [cards, publish, sections],
  );

  const cycleSectionReach = useCallback(
    (id: string) => {
      const section = sections.find((s) => s.id === id);
      if (!section) return;
      const currentReach: Reach = section.visibility ?? 'public';
      const nextReach = next(REACH_ORDER, currentReach);
      const nextSection = { ...section, visibility: nextReach };
      publish(
        cards,
        sections.map((s) => (s.id === id ? nextSection : s)),
      );
      void apiUpdateProfileSection(id, {
        settings: { ...section.settings, visibility: nextReach },
      }).catch(() => {
        setSections(sections);
      });
    },
    [cards, publish, sections],
  );

  // Tile size on the board. Cycles through the sizes this tile can honour —
  // `tileSizeFloor` keeps a paragraph from being offered a 1x1, so the owner
  // is never given a choice the board would silently override
  // (docs/spaces/profile.md, "the tile board").
  const cycleCardSize = useCallback(
    (cardType: string) => {
      const card = cards.find((c) => c.card_type === cardType);
      if (!card) return;

      const def = PROFILE_FIELD_BY_KEY[card.card_type];
      const floor = def ? tileSizeFloor(def.answerType) : 'l';
      // Only the sizes at or above this tile's floor, cycled directly —
      // `next` wants a non-empty tuple and a slice isn't one.
      const choices = SIZE_ORDER.slice(SIZE_ORDER.indexOf(floor));
      const current = (card.settings.size as TileSize | undefined) ?? floor;
      const nextSize =
        choices[(choices.indexOf(current) + 1) % choices.length] ?? floor;
      const nextSettings = { ...card.settings, size: nextSize };

      publish(
        cards.map((c) =>
          c.card_type === cardType ? { ...c, settings: nextSettings } : c,
        ),
        sections,
      );
      void apiUpsertProfileCard(cardType, { settings: nextSettings }).catch(
        () => {
          setCards(cards);
        },
      );
    },
    [cards, sections, publish, setCards],
  );

  const cycleSectionSize = useCallback(
    (id: string) => {
      const section = sections.find((s) => s.id === id);
      if (!section) return;

      // A korner shelf is never smaller than half-width.
      const choices = SIZE_ORDER.slice(SIZE_ORDER.indexOf('m'));
      const current = (section.settings.size as TileSize | undefined) ?? 'm';
      const nextSize =
        choices[(choices.indexOf(current) + 1) % choices.length] ?? 'm';
      const nextSettings = { ...section.settings, size: nextSize };

      publish(
        cards,
        sections.map((s) =>
          s.id === id ? { ...s, settings: nextSettings } : s,
        ),
      );
      void apiUpdateProfileSection(id, { settings: nextSettings }).catch(() => {
        setSections(sections);
      });
    },
    [cards, sections, publish, setSections],
  );

  const cycleSectionOrder = useCallback(
    (id: string) => {
      const section = sections.find((s) => s.id === id);
      if (!section) return;
      const current = ((section.settings.order as string | undefined) ??
        'newest') as OrderMode;
      const nextOrder = next(ORDER_ORDER, current);
      const nextSettings = { ...section.settings, order: nextOrder };
      const nextSection = { ...section, settings: nextSettings };
      publish(
        cards,
        sections.map((s) => (s.id === id ? nextSection : s)),
      );
      void apiUpdateProfileSection(id, { settings: nextSettings }).catch(() => {
        setSections(sections);
      });
      // Landing on `chosen` for the first time (or with no picks yet)
      // is a good moment to prompt the owner to populate them — but
      // don't force-open on every cycle, only when the mode flips to
      // chosen from something else AND there's no curated list yet.
      if (
        nextOrder === 'chosen' &&
        Array(section.settings.order_ids as string[] | undefined).length === 0
      ) {
        setPicking(id);
      }
    },
    [cards, publish, sections],
  );

  const openPicker = useCallback((id: string) => {
    setPicking(id);
  }, []);

  const closePicker = useCallback(() => {
    setPicking(null);
  }, []);

  const handlePickerSaved = useCallback(
    (orderIds: string[]) => {
      if (!picking) return;
      const section = sections.find((s) => s.id === picking);
      if (!section) {
        setPicking(null);
        return;
      }
      const nextSettings = {
        ...section.settings,
        order: 'chosen',
        order_ids: orderIds,
      };
      publish(
        cards,
        sections.map((s) =>
          s.id === picking ? { ...s, settings: nextSettings } : s,
        ),
      );
      setPicking(null);
    },
    [cards, picking, publish, sections],
  );

  const moveSectionUp = useCallback(
    (key: string) => {
      moveSection(key, -1);
    },
    [moveSection],
  );
  const moveSectionDown = useCallback(
    (key: string) => {
      moveSection(key, 1);
    },
    [moveSection],
  );

  // ── Drag reorder ────────────────────────────────────────────────
  const handleDragStart = useCallback(
    (key: string, family: 'told' | 'drawn') => {
      setDragging({ key, family });
      setDragTarget(null);
    },
    [],
  );

  const handleDragOver = useCallback(
    (key: string, family: 'told' | 'drawn', pos: 'above' | 'below') => {
      // Only allow drop within the same family — cards and sections
      // have their own reorder endpoints, and cross-family drop would
      // need a shared position we don't have yet.
      if (dragging && dragging.family === family) {
        setDragTarget({ key, pos });
      }
    },
    [dragging],
  );

  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setDragTarget(null);
  }, []);

  const handleDropCards = useCallback(
    (targetKey: string, pos: 'above' | 'below') => {
      if (
        !dragging ||
        dragging.family !== 'told' ||
        dragging.key === targetKey
      ) {
        return;
      }
      const fromIdx = cards.findIndex((c) => c.card_type === dragging.key);
      const targetIdx = cards.findIndex((c) => c.card_type === targetKey);
      if (fromIdx < 0 || targetIdx < 0) return;
      const nextCards = [...cards];
      const [moved] = nextCards.splice(fromIdx, 1);
      if (!moved) return;
      // If we removed something before the target, the target's index
      // shifts down by 1.
      const insertBase = fromIdx < targetIdx ? targetIdx - 1 : targetIdx;
      const insertAt = pos === 'below' ? insertBase + 1 : insertBase;
      nextCards.splice(insertAt, 0, moved);
      publish(nextCards, sections);
      void apiReorderProfileCards(nextCards.map((c) => c.card_type)).catch(
        () => {
          setCards(cards);
        },
      );
    },
    [cards, dragging, publish, sections],
  );

  const handleDropSections = useCallback(
    (targetKey: string, pos: 'above' | 'below') => {
      if (
        !dragging ||
        dragging.family !== 'drawn' ||
        dragging.key === targetKey
      ) {
        return;
      }
      const fromIdx = sections.findIndex((s) => s.id === dragging.key);
      const targetIdx = sections.findIndex((s) => s.id === targetKey);
      if (fromIdx < 0 || targetIdx < 0) return;
      const nextSections = [...sections];
      const [moved] = nextSections.splice(fromIdx, 1);
      if (!moved) return;
      const insertBase = fromIdx < targetIdx ? targetIdx - 1 : targetIdx;
      const insertAt = pos === 'below' ? insertBase + 1 : insertBase;
      nextSections.splice(insertAt, 0, moved);
      publish(cards, nextSections);
      void apiReorderProfileSections(nextSections.map((s) => s.id)).catch(
        () => {
          setSections(sections);
        },
      );
    },
    [cards, dragging, publish, sections],
  );

  const handleDrop = useCallback(
    (targetKey: string, family: 'told' | 'drawn') => {
      if (!dragTarget) return;
      const pos = dragTarget.pos;
      setDragging(null);
      setDragTarget(null);
      if (family === 'told') handleDropCards(targetKey, pos);
      else handleDropSections(targetKey, pos);
    },
    [dragTarget, handleDropCards, handleDropSections],
  );

  const removeSection = useCallback(
    (id: string) => {
      publish(
        cards,
        sections.filter((s) => s.id !== id),
      );
      void apiDeleteProfileSection(id).catch(() => {
        setSections(sections);
      });
    },
    [cards, publish, sections],
  );

  // ── Library adds ────────────────────────────────────────────────
  // Adding a told preset opens the composer for that card_type. The
  // composer upserts on save; nothing is created if the owner cancels.
  const addCardFromLibrary = useCallback((cardType: string) => {
    setComposing(cardType);
  }, []);

  const openComposerForExisting = useCallback((cardType: string) => {
    setComposing(cardType);
  }, []);

  const closeComposer = useCallback(() => {
    setComposing(null);
  }, []);

  const handleComposerSaved = useCallback(
    (saved: ApiProfileCardJSON) => {
      const idx = cards.findIndex((c) => c.card_type === saved.card_type);
      const nextCards =
        idx < 0
          ? [...cards, saved]
          : cards.map((c) => (c.card_type === saved.card_type ? saved : c));
      publish(nextCards, sections);
      setComposing(null);
    },
    [cards, publish, sections],
  );

  const addSectionFromLibrary = useCallback(
    (kornerSlug: string) => {
      const render = KORNER_RENDER[kornerSlug] ?? 'korner';
      const title = KORNER_SOURCE[kornerSlug] ?? kornerSlug;
      void apiCreateProfileSection({
        section_type: 'drawn',
        title,
        settings: {
          render,
          korner_slug: kornerSlug,
          order: 'newest',
        },
      })
        .then((created) => {
          publish(cards, [...sections, created]);
        })
        .catch(() => undefined);
    },
    [cards, publish, sections],
  );

  return (
    <div className='profile-shelves__arrange'>
      <div className='profile-shelves__arrange-kicker'>
        {intl.formatMessage(messages.kicker)}
      </div>
      <h2 className='profile-shelves__arrange-title'>
        {intl.formatMessage(messages.title)}
      </h2>
      <p className='profile-shelves__arrange-lede'>
        {intl.formatMessage(messages.lede)}
      </p>

      <div className='profile-shelves__arrange-list'>
        {cards.map((card, i) => (
          <ArrangeSlab
            key={`card-${card.card_type}`}
            slabKey={card.card_type}
            family='told'
            name={
              CARD_TITLE[card.card_type] ?? card.card_type.replaceAll('_', ' ')
            }
            source={null}
            visible={card.visible}
            reach={card.visibility}
            canMoveUp={i > 0}
            canMoveDown={i < cards.length - 1}
            isDragging={dragging?.key === card.card_type}
            isDragTarget={
              dragTarget?.key === card.card_type ? dragTarget.pos : null
            }
            onMoveUp={moveCardUp}
            onMoveDown={moveCardDown}
            onToggleVisible={toggleCardVisible}
            onCycleReach={cycleCardReach}
            onCycleSize={cycleCardSize}
            size={(card.settings.size as TileSize | undefined) ?? null}
            onRemove={removeCard}
            onEdit={openComposerForExisting}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
          />
        ))}
        {sections.map((section, i) => {
          const render = section.settings.render as string | undefined;
          const kornerSlug = section.settings.korner_slug as string | undefined;
          const source = kornerSlug
            ? (KORNER_SOURCE[kornerSlug] ?? kornerSlug)
            : (render ?? 'Section');
          const order = ((section.settings.order as string | undefined) ??
            'newest') as OrderMode;
          return (
            <ArrangeSlab
              key={`section-${section.id}`}
              slabKey={section.id}
              family='drawn'
              name={section.title ?? source}
              source={source}
              visible={section.visible}
              reach={section.visibility ?? 'public'}
              order={order}
              canMoveUp={i > 0}
              canMoveDown={i < sections.length - 1}
              isDragging={dragging?.key === section.id}
              isDragTarget={
                dragTarget?.key === section.id ? dragTarget.pos : null
              }
              onMoveUp={moveSectionUp}
              onMoveDown={moveSectionDown}
              onEdit={order === 'chosen' ? openPicker : undefined}
              onToggleVisible={toggleSectionVisible}
              onCycleReach={cycleSectionReach}
              onCycleOrder={cycleSectionOrder}
              onCycleSize={cycleSectionSize}
              size={(section.settings.size as TileSize | undefined) ?? null}
              onRemove={removeSection}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            />
          );
        })}
      </div>

      {library && (
        <LibraryGrid
          library={library}
          onAddCard={addCardFromLibrary}
          onAddSection={addSectionFromLibrary}
        />
      )}

      {composing && (
        <TellComposer
          cardType={composing}
          cardTitle={CARD_TITLE[composing] ?? composing.replaceAll('_', ' ')}
          initial={cards.find((c) => c.card_type === composing) ?? null}
          onSaved={handleComposerSaved}
          onCancel={closeComposer}
        />
      )}

      {picking &&
        (() => {
          const section = sections.find((s) => s.id === picking);
          if (!section) return null;
          const kornerSlug =
            (section.settings.korner_slug as string | undefined) ?? 'korner';
          const orderIds = Array.isArray(section.settings.order_ids)
            ? (section.settings.order_ids as string[])
            : [];
          return (
            <PostPicker
              accountId={ownerAccountId}
              sectionId={section.id}
              kornerSlug={kornerSlug}
              initialOrderIds={orderIds}
              onSaved={handlePickerSaved}
              onCancel={closePicker}
            />
          );
        })()}
    </div>
  );
};
