import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import type { ApiProfileLibraryJSON } from 'mastodon/api/profile_library';
import { apiGetProfileLibrary } from 'mastodon/api/profile_library';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import {
  apiCreateProfileSection,
  apiReorderProfileSections,
  apiUpdateProfileSection,
} from 'mastodon/api/profile_sections';

// The korner-connections selector (mobile-first): a scrolling list of the
// korner sections you can surface on your profile — albums, treks, tracks,
// listings, etc. Toggle each on/off and reorder with the arrows; turning one
// off never deletes anything, it just stops showing.
//
// Fields (About / Interests / Pronouns / …) used to live here too, but they
// moved to the Fields pop-up (ProfileFieldsEditor) — this list is korner
// projections only now. Reorder persists via the sections endpoint.

const messages = defineMessages({
  title: {
    id: 'profile_shelves.creator.title',
    defaultMessage: 'Korner connections',
  },
  lede: {
    id: 'profile_shelves.creator.lede',
    defaultMessage:
      'Show what you share in your korners — albums, treks, and more. Turn a connection on or off, and reorder with the arrows.',
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
    defaultMessage: 'No korner connections yet — turn one on below.',
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

const kornerSlugOf = (section: ApiProfileSectionJSON) =>
  section.settings.korner_slug as string | undefined;

// One korner connection in the list.
interface Option {
  key: string;
  name: string;
  source: string | null;
  on: boolean;
  kornerSlug: string;
  card: string;
  sectionId?: string;
}

// One row of the list. Its own component so the toggle / move handlers are
// stable callbacks bound to the row's option — no inline arrows in the map.
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
  // Passed through unchanged — this surface only manages korner sections
  // now; fields (cards) are edited in the Fields pop-up.
  cards: ApiProfileCardJSON[];
  sections: ApiProfileSectionJSON[];
  onChange: (next: {
    cards: ApiProfileCardJSON[];
    sections: ApiProfileSectionJSON[];
  }) => void;
}

export const SectionSelector: React.FC<SectionSelectorProps> = ({
  cards,
  sections: initialSections,
  onChange,
}) => {
  const intl = useIntl();

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
    (nextSections: ApiProfileSectionJSON[]) => {
      setSections(nextSections);
      onChange({ cards, sections: nextSections });
    },
    [onChange, cards],
  );

  // Build the two groups (on / available) from the drawn korner catalog.
  const { onOptions, availableOptions } = useMemo(() => {
    const drawn: Option[] = (library?.drawn ?? []).map((preset) => {
      const section = sections.find(
        (s) => kornerSlugOf(s) === preset.korner_slug,
      );
      return {
        key: `drawn:${preset.korner_slug}`,
        name: preset.name,
        source: preset.source_label,
        on: !!section && section.visible,
        kornerSlug: preset.korner_slug,
        card: preset.card,
        sectionId: section?.id,
      };
    });

    const sectionPos = (id: string | undefined) =>
      sections.find((s) => s.id === id)?.position ?? 0;

    return {
      onOptions: drawn
        .filter((o) => o.on)
        .sort((a, b) => sectionPos(a.sectionId) - sectionPos(b.sectionId)),
      availableOptions: drawn.filter((o) => !o.on),
    };
  }, [library, sections]);

  const toggle = useCallback(
    (option: Option) => {
      const on = !option.on;
      const prevSections = sections;
      const section = sections.find(
        (s) => kornerSlugOf(s) === option.kornerSlug,
      );

      if (section) {
        publish(
          sections.map((s) =>
            s.id === section.id ? { ...s, visible: on } : s,
          ),
        );
        void apiUpdateProfileSection(section.id, { visible: on }).catch(() => {
          setSections(prevSections);
        });
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
            publish([...sections, created]);
            return undefined;
          })
          .catch(() => undefined);
      }
    },
    [sections, publish],
  );

  const move = useCallback(
    (option: Option, delta: 1 | -1) => {
      if (!option.sectionId) return;
      const visibleIds = onOptions.map((o) => o.sectionId ?? '');
      const idx = visibleIds.indexOf(option.sectionId);
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
        (x, y) => fullOrder.indexOf(x.id) - fullOrder.indexOf(y.id),
      );
      publish(nextSections);
      void apiReorderProfileSections(fullOrder).catch(() => {
        setSections(sections);
      });
    },
    [sections, onOptions, publish],
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
