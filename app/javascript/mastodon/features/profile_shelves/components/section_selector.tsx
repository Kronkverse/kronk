import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import {
  apiReorderProfileCards,
  apiUpsertProfileCard,
} from 'mastodon/api/profile_cards';
import type { ApiProfileLibraryJSON } from 'mastodon/api/profile_library';
import { apiGetProfileLibrary } from 'mastodon/api/profile_library';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import {
  apiCreateProfileSection,
  apiReorderProfileSections,
  apiUpdateProfileSection,
} from 'mastodon/api/profile_sections';

// The simple profile creator (mobile-first): one scrolling selection
// list of the available profile sections. Every option has an on/off
// switch; the ones that are on can be reordered with up/down. Turning
// an option off never deletes anything — it just stops showing.
//
// Two families sit behind the list, matching the read view
// (ShelvesStack renders told cards, then drawn korner sections):
//   • told  — owner-authored cards (About, Interests, …). Toggling one
//             on shows an empty card; writing its content is a separate
//             surface (parked composer), not part of this list yet.
//   • drawn — korner projections (Albutts, Booth, …). Content-free, so
//             toggling on simply creates/shows the projection.
// Reorder persists per family (cards among cards, sections among
// sections) — there is no cross-family position column yet.

const messages = defineMessages({
  title: {
    id: 'profile_shelves.creator.title',
    defaultMessage: 'Your profile',
  },
  lede: {
    id: 'profile_shelves.creator.lede',
    defaultMessage:
      'Turn sections on or off, and drag the order with the arrows.',
  },
  onHeading: {
    id: 'profile_shelves.creator.on_heading',
    defaultMessage: 'On your profile',
  },
  availableHeading: {
    id: 'profile_shelves.creator.available_heading',
    defaultMessage: 'Available to add',
  },
  onEmpty: {
    id: 'profile_shelves.creator.on_empty',
    defaultMessage: 'Nothing on your profile yet — turn something on below.',
  },
  availableEmpty: {
    id: 'profile_shelves.creator.available_empty',
    defaultMessage: 'Everything is on your profile.',
  },
  moveUp: { id: 'profile_shelves.creator.move_up', defaultMessage: 'Move up' },
  moveDown: {
    id: 'profile_shelves.creator.move_down',
    defaultMessage: 'Move down',
  },
  turnOn: { id: 'profile_shelves.creator.turn_on', defaultMessage: 'Turn on' },
  turnOff: {
    id: 'profile_shelves.creator.turn_off',
    defaultMessage: 'Turn off',
  },
});

// Human labels for the fixed told card_types (ProfileCard::CARD_TYPES).
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

const humanize = (slug: string) => slug.replaceAll('_', ' ');

const kornerSlugOf = (section: ApiProfileSectionJSON) =>
  section.settings.korner_slug as string | undefined;

// One logical option in the list — either a told card_type or a drawn
// korner projection — flattened so the two families render uniformly.
interface Option {
  key: string;
  family: 'told' | 'drawn';
  name: string;
  source: string | null;
  on: boolean;
  // Family-specific handles used by the mutation callbacks.
  cardType?: string;
  kornerSlug?: string;
  card?: string;
  sectionId?: string;
}

// One row of the selection list. Its own component so the toggle /
// move handlers are stable callbacks bound to the row's option — no
// inline arrows in the list map (matches the ArrangeSlab pattern).
interface SelectorRowProps {
  option: Option;
  index: number;
  total: number;
  reorderable: boolean;
  onToggle: (option: Option) => void;
  onMove: (option: Option, delta: 1 | -1) => void;
}

const SelectorRow: React.FC<SelectorRowProps> = ({
  option,
  index,
  total,
  reorderable,
  onToggle,
  onMove,
}) => {
  const intl = useIntl();
  const handleToggle = useCallback(() => {
    onToggle(option);
  }, [onToggle, option]);
  const handleUp = useCallback(() => {
    onMove(option, -1);
  }, [onMove, option]);
  const handleDown = useCallback(() => {
    onMove(option, 1);
  }, [onMove, option]);

  return (
    <li className='profile-creator__row'>
      {reorderable && (
        <div className='profile-creator__reorder'>
          <button
            type='button'
            className='profile-creator__move'
            onClick={handleUp}
            disabled={index === 0}
            aria-label={intl.formatMessage(messages.moveUp)}
          >
            ▲
          </button>
          <button
            type='button'
            className='profile-creator__move'
            onClick={handleDown}
            disabled={index === total - 1}
            aria-label={intl.formatMessage(messages.moveDown)}
          >
            ▼
          </button>
        </div>
      )}
      <div className='profile-creator__label'>
        <span className='profile-creator__name'>{option.name}</span>
        {option.source && (
          <span className='profile-creator__source'>{option.source}</span>
        )}
      </div>
      <button
        type='button'
        className='profile-creator__switch'
        role='switch'
        aria-checked={option.on}
        aria-label={intl.formatMessage(
          option.on ? messages.turnOff : messages.turnOn,
        )}
        onClick={handleToggle}
      >
        <span className='profile-creator__switch-knob' aria-hidden='true' />
      </button>
    </li>
  );
};

interface SectionSelectorProps {
  cards: ApiProfileCardJSON[];
  sections: ApiProfileSectionJSON[];
  onChange: (next: {
    cards: ApiProfileCardJSON[];
    sections: ApiProfileSectionJSON[];
  }) => void;
}

export const SectionSelector: React.FC<SectionSelectorProps> = ({
  cards: initialCards,
  sections: initialSections,
  onChange,
}) => {
  const intl = useIntl();

  const [cards, setCards] = useState(initialCards);
  const [sections, setSections] = useState(initialSections);
  const [library, setLibrary] = useState<ApiProfileLibraryJSON | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiGetProfileLibrary()
      .then((data) => {
        if (!cancelled) setLibrary(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setLibrary({ told: [], drawn: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // ── Build the two ordered groups from the catalog + current state ──
  const { onOptions, availableOptions } = useMemo(() => {
    const told: Option[] = (library?.told ?? []).map((preset) => {
      const card = cards.find((c) => c.card_type === preset.card_type);
      return {
        key: `told:${preset.card_type}`,
        family: 'told',
        name: CARD_TITLE[preset.card_type] ?? humanize(preset.card_type),
        source: null,
        on: !!card && card.visible,
        cardType: preset.card_type,
      };
    });
    const drawn: Option[] = (library?.drawn ?? []).map((preset) => {
      const section = sections.find(
        (s) => kornerSlugOf(s) === preset.korner_slug,
      );
      return {
        key: `drawn:${preset.korner_slug}`,
        family: 'drawn',
        name: preset.name,
        source: preset.source_label,
        on: !!section && section.visible,
        kornerSlug: preset.korner_slug,
        card: preset.card,
        sectionId: section?.id,
      };
    });

    // "On" keeps the read-view order: told (by card position) then
    // drawn (by section position). "Available" is everything still off.
    const cardPos = (t: string) =>
      cards.find((c) => c.card_type === t)?.position ?? 0;
    const sectionPos = (id: string | undefined) =>
      sections.find((s) => s.id === id)?.position ?? 0;

    const onTold = told
      .filter((o) => o.on)
      .sort((a, b) => cardPos(a.cardType ?? '') - cardPos(b.cardType ?? ''));
    const onDrawn = drawn
      .filter((o) => o.on)
      .sort((a, b) => sectionPos(a.sectionId) - sectionPos(b.sectionId));

    return {
      onOptions: [...onTold, ...onDrawn],
      availableOptions: [...told, ...drawn].filter((o) => !o.on),
    };
  }, [library, cards, sections]);

  // ── Toggle on/off ─────────────────────────────────────────────────
  const toggle = useCallback(
    (option: Option) => {
      const on = !option.on;
      const prevCards = cards;
      const prevSections = sections;

      if (option.family === 'told' && option.cardType) {
        const cardType = option.cardType;
        const existing = cards.find((c) => c.card_type === cardType);
        // Optimistic: flip visible locally (append a stub if brand new).
        const nextCards = existing
          ? cards.map((c) =>
              c.card_type === cardType ? { ...c, visible: on } : c,
            )
          : [
              ...cards,
              {
                id: `pending-${cardType}`,
                card_type: cardType,
                body: '',
                render: 'block',
                visibility: 'public',
                position: cards.length,
                visible: on,
              } as ApiProfileCardJSON,
            ];
        publish(nextCards, sections);
        void apiUpsertProfileCard(cardType, { visible: on })
          .then((saved) => {
            // Reconcile the stub / server truth into local state.
            setCards((cs) => {
              const has = cs.some((c) => c.card_type === saved.card_type);
              return has
                ? cs.map((c) => (c.card_type === saved.card_type ? saved : c))
                : [...cs, saved];
            });
            return undefined;
          })
          .catch(() => {
            setCards(prevCards);
          });
        return;
      }

      if (option.family === 'drawn' && option.kornerSlug) {
        const section = sections.find(
          (s) => kornerSlugOf(s) === option.kornerSlug,
        );
        if (section) {
          publish(
            cards,
            sections.map((s) =>
              s.id === section.id ? { ...s, visible: on } : s,
            ),
          );
          void apiUpdateProfileSection(section.id, { visible: on }).catch(
            () => {
              setSections(prevSections);
            },
          );
        } else if (on) {
          // First time on — create the projection.
          void apiCreateProfileSection({
            section_type: 'drawn',
            title: option.name,
            settings: {
              render: option.card,
              korner_slug: option.kornerSlug,
              order: 'newest',
            },
          })
            .then((created) => {
              publish(cards, [...sections, created]);
              return undefined;
            })
            .catch(() => undefined);
        }
      }
    },
    [cards, sections, publish],
  );

  // ── Reorder within a family ───────────────────────────────────────
  const moveCard = useCallback(
    (cardType: string, delta: 1 | -1) => {
      const visibleTypes = onOptions
        .filter((o) => o.family === 'told')
        .map((o) => o.cardType ?? '');
      const idx = visibleTypes.indexOf(cardType);
      const targetIdx = idx + delta;
      if (idx < 0 || targetIdx < 0 || targetIdx >= visibleTypes.length) return;
      const reordered = [...visibleTypes];
      const a = reordered[idx];
      const b = reordered[targetIdx];
      if (a === undefined || b === undefined) return;
      reordered[idx] = b;
      reordered[targetIdx] = a;
      // Full card order = reordered visible ones, then the rest (off,
      // order irrelevant since they don't render).
      const rest = cards
        .map((c) => c.card_type)
        .filter((t) => !reordered.includes(t));
      const fullOrder = [...reordered, ...rest];
      const nextCards = [...cards].sort(
        (a, b) =>
          fullOrder.indexOf(a.card_type) - fullOrder.indexOf(b.card_type),
      );
      publish(nextCards, sections);
      void apiReorderProfileCards(fullOrder).catch(() => {
        setCards(cards);
      });
    },
    [cards, sections, onOptions, publish],
  );

  const moveSection = useCallback(
    (sectionId: string, delta: 1 | -1) => {
      const visibleIds = onOptions
        .filter((o) => o.family === 'drawn')
        .map((o) => o.sectionId ?? '');
      const idx = visibleIds.indexOf(sectionId);
      const targetIdx = idx + delta;
      if (idx < 0 || targetIdx < 0 || targetIdx >= visibleIds.length) return;
      const reordered = [...visibleIds];
      const a = reordered[idx];
      const b = reordered[targetIdx];
      if (a === undefined || b === undefined) return;
      reordered[idx] = b;
      reordered[targetIdx] = a;
      const rest = sections
        .map((s) => s.id)
        .filter((id) => !reordered.includes(id));
      const fullOrder = [...reordered, ...rest];
      const nextSections = [...sections].sort(
        (a, b) => fullOrder.indexOf(a.id) - fullOrder.indexOf(b.id),
      );
      publish(cards, nextSections);
      void apiReorderProfileSections(fullOrder).catch(() => {
        setSections(sections);
      });
    },
    [cards, sections, onOptions, publish],
  );

  const move = useCallback(
    (option: Option, delta: 1 | -1) => {
      if (option.family === 'told' && option.cardType) {
        moveCard(option.cardType, delta);
      } else if (option.family === 'drawn' && option.sectionId) {
        moveSection(option.sectionId, delta);
      }
    },
    [moveCard, moveSection],
  );

  return (
    <div className='profile-creator'>
      <h2 className='profile-creator__title'>
        {intl.formatMessage(messages.title)}
      </h2>
      <p className='profile-creator__lede'>
        {intl.formatMessage(messages.lede)}
      </p>

      <p className='profile-creator__group-heading'>
        {intl.formatMessage(messages.onHeading)}
      </p>
      {onOptions.length > 0 ? (
        <ul className='profile-creator__list'>
          {onOptions.map((option, i) => (
            <SelectorRow
              key={option.key}
              option={option}
              index={i}
              total={onOptions.length}
              reorderable
              onToggle={toggle}
              onMove={move}
            />
          ))}
        </ul>
      ) : (
        <p className='profile-creator__empty'>
          {intl.formatMessage(messages.onEmpty)}
        </p>
      )}

      <p className='profile-creator__group-heading'>
        {intl.formatMessage(messages.availableHeading)}
      </p>
      {availableOptions.length > 0 ? (
        <ul className='profile-creator__list'>
          {availableOptions.map((option, i) => (
            <SelectorRow
              key={option.key}
              option={option}
              index={i}
              total={availableOptions.length}
              reorderable={false}
              onToggle={toggle}
              onMove={move}
            />
          ))}
        </ul>
      ) : (
        <p className='profile-creator__empty'>
          {intl.formatMessage(messages.availableEmpty)}
        </p>
      )}
    </div>
  );
};
