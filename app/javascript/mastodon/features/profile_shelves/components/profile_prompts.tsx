import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import type { ApiDrawnPresetJSON } from 'mastodon/api/profile_library';
import {
  apiGetProfileLibrary,
  glyphSlugOf,
  shelfKeyOf,
} from 'mastodon/api/profile_library';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import {
  apiCreateProfileSection,
  apiUpdateProfileSection,
} from 'mastodon/api/profile_sections';
import { Icon } from 'mastodon/components/icon';
import { KornerGlyph } from 'mastodon/components/korner_glyph';

// ProfilePrompts — the spaces on your own profile that are waiting for you
// (Tal 2026-10-18: apart from "Nothing on the shelves yet" nothing said a
// profile could be set up). Owner only, outside designing; nobody else
// ever sees them.
//
// Each is a dashed card with a +, sitting where the thing it adds would go:
//
//   - one per korner you've posted in that has no shelf yet, most posts
//     first. Tapping it puts that korner's shelf on, the same as ticking
//     it while designing; the shelf shows your newest posts there, each
//     still at its own reach;
//   - "Say who you are", while no profile Kuestions are answered, which
//     starts designing open on the Kuestions, and "Design your profile"
//     at the end, which starts designing.
//
// Once there is nothing left to suggest, they go, unless the profile is
// still empty.
//
// Nothing is filled in for you: the cards suggest, you choose.

const MAX_KORNERS = 4;

const messages = defineMessages({
  title: {
    id: 'profile_prompts.title',
    defaultMessage: 'Make it yours',
  },
  lede: {
    id: 'profile_prompts.lede',
    defaultMessage: 'Only you see these.',
  },
  korner: {
    id: 'profile_prompts.korner',
    defaultMessage: 'Show your {name}',
  },
  kornerCount: {
    id: 'profile_prompts.korner_count',
    defaultMessage: '{count, plural, one {# post} other {# posts}} to share',
  },
  kuestions: {
    id: 'profile_prompts.kuestions',
    defaultMessage: 'Say who you are',
  },
  kuestionsHint: {
    id: 'profile_prompts.kuestions_hint',
    defaultMessage: 'Answer a few profile Kuestions',
  },
  design: {
    id: 'profile_prompts.design',
    defaultMessage: 'Design your profile',
  },
  designHint: {
    id: 'profile_prompts.design_hint',
    defaultMessage: 'Photo, cover, bio and shelves',
  },
});

// The shelf's own key: its korner, or korner:source ('albutts:tagged').
const shelfKey = (section: ApiProfileSectionJSON) =>
  shelfKeyOf(section.settings);

interface CardProps {
  title: string;
  hint: string;
  slug?: string;
  onClick: () => void;
}

const PromptCard: React.FC<CardProps> = ({ title, hint, slug, onClick }) => (
  <button type='button' className='profile-prompts__card' onClick={onClick}>
    <span className='profile-prompts__plus' aria-hidden='true'>
      <Icon id='add' icon={AddIcon} />
    </span>
    {slug && (
      <KornerGlyph
        slug={slug}
        className='profile-prompts__glyph'
        aria-hidden='true'
      />
    )}
    <span className='profile-prompts__name'>{title}</span>
    <span className='profile-prompts__hint'>{hint}</span>
  </button>
);

const KornerPrompt: React.FC<{
  preset: ApiDrawnPresetJSON;
  onAdd: (preset: ApiDrawnPresetJSON) => void;
}> = ({ preset, onAdd }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onAdd(preset);
  }, [onAdd, preset]);

  return (
    <PromptCard
      slug={glyphSlugOf(preset)}
      title={intl.formatMessage(messages.korner, { name: preset.name })}
      hint={intl.formatMessage(messages.kornerCount, { count: preset.count })}
      onClick={handleClick}
    />
  );
};

interface Props {
  sections: ApiProfileSectionJSON[];
  hasKuestions: boolean;
  // Nothing on the profile yet: show the cards even with nothing to
  // suggest, so the space isn't blank.
  empty: boolean;
  onSectionsChange: (next: ApiProfileSectionJSON[]) => void;
  onDesign: () => void;
  onKuestions: () => void;
}

export const ProfilePrompts: React.FC<Props> = ({
  sections,
  hasKuestions,
  empty,
  onSectionsChange,
  onDesign,
  onKuestions,
}) => {
  const intl = useIntl();
  const [drawn, setDrawn] = useState<ApiDrawnPresetJSON[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiGetProfileLibrary()
      .then((data) => {
        if (!cancelled) setDrawn(data.drawn);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setDrawn([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Korners with something in them whose shelf isn't on the profile. A
  // shelf taken off is still a row, hidden, so match on visible ones.
  const suggestions = useMemo(() => {
    const on = new Set(
      sections.filter((s) => s.visible).map((s) => shelfKey(s)),
    );
    return (drawn ?? [])
      .filter((p) => p.count > 0 && !on.has(p.key))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, MAX_KORNERS);
  }, [drawn, sections]);

  // The same as ticking the korner while designing: a shelf taken off
  // before comes back with what was chosen for it; otherwise a new one
  // shows the newest posts.
  const add = useCallback(
    (preset: ApiDrawnPresetJSON) => {
      const existing = sections.find((s) => shelfKey(s) === preset.key);

      if (existing) {
        void apiUpdateProfileSection(existing.id, { visible: true })
          .then((updated) => {
            onSectionsChange(
              sections.map((s) => (s.id === updated.id ? updated : s)),
            );
            return undefined;
          })
          .catch(() => undefined);
        return;
      }

      void apiCreateProfileSection({
        section_type: 'drawn',
        title: preset.name,
        settings: {
          render: preset.card,
          korner_slug: preset.korner_slug,
          ...(preset.source ? { source: preset.source } : {}),
          order: 'newest',
        },
      })
        .then((created) => {
          onSectionsChange([...sections, created]);
          return undefined;
        })
        .catch(() => undefined);
    },
    [sections, onSectionsChange],
  );

  if (drawn === null) return null;
  if (!empty && hasKuestions && suggestions.length === 0) return null;

  return (
    <section
      className='profile-prompts'
      aria-label={intl.formatMessage(messages.title)}
    >
      <h3 className='profile-prompts__title'>
        {intl.formatMessage(messages.title)}
      </h3>
      <p className='profile-prompts__lede'>
        {intl.formatMessage(messages.lede)}
      </p>

      <div className='profile-prompts__grid'>
        {!hasKuestions && (
          <PromptCard
            title={intl.formatMessage(messages.kuestions)}
            hint={intl.formatMessage(messages.kuestionsHint)}
            onClick={onKuestions}
          />
        )}

        {suggestions.map((preset) => (
          <KornerPrompt key={preset.korner_slug} preset={preset} onAdd={add} />
        ))}

        <PromptCard
          title={intl.formatMessage(messages.design)}
          hint={intl.formatMessage(messages.designHint)}
          onClick={onDesign}
        />
      </div>
    </section>
  );
};
