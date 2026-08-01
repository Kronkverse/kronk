import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileLibraryJSON } from 'mastodon/api/profile_library';

// The Library grid at the bottom of Arrange mode — the "Add a shelf"
// picker. Told presets come from ProfileCard::CARD_TYPES the account
// hasn't filled in yet; drawn presets are the korners this account
// has posts for (or could post to). Server enumerates both via
// GET /api/v1/profile/library (see #1078).

const messages = defineMessages({
  add: {
    id: 'profile_shelves.library.heading',
    defaultMessage: 'Add a shelf',
  },
  cardAbout: {
    id: 'profile_shelves.card_type.about',
    defaultMessage: 'About',
  },
  cardInterests: {
    id: 'profile_shelves.card_type.interests',
    defaultMessage: 'Interests',
  },
  cardValues: {
    id: 'profile_shelves.card_type.values',
    defaultMessage: 'Values',
  },
  cardExploring: {
    id: 'profile_shelves.card_type.exploring',
    defaultMessage: 'Currently exploring',
  },
  cardPersonality: {
    id: 'profile_shelves.card_type.personality',
    defaultMessage: 'Personality',
  },
  cardDrive: {
    id: 'profile_shelves.card_type.drive',
    defaultMessage: 'What drives me',
  },
  cardRotation: {
    id: 'profile_shelves.card_type.rotation',
    defaultMessage: 'In rotation',
  },
  cardMoments: {
    id: 'profile_shelves.card_type.moments',
    defaultMessage: 'Moments',
  },
  cardNote: {
    id: 'profile_shelves.card_type.note',
    defaultMessage: 'Note',
  },
  cardHighlights: {
    id: 'profile_shelves.card_type.highlights',
    defaultMessage: 'Highlights',
  },
  cardAtAGlance: {
    id: 'profile_shelves.card_type.at_a_glance',
    defaultMessage: 'At a glance',
  },
  cardOpenTo: {
    id: 'profile_shelves.card_type.open_to',
    defaultMessage: 'Open to',
  },
  cardWhereIAm: {
    id: 'profile_shelves.card_type.where_i_am',
    defaultMessage: 'Where I am',
  },
  cardPodCredentials: {
    id: 'profile_shelves.card_type.pod_credentials',
    defaultMessage: 'Pod credentials',
  },
  writtenByYou: {
    id: 'profile_shelves.library.written_by_you',
    defaultMessage: 'Written by you',
  },
  posts: {
    id: 'profile_shelves.library.posts_count',
    defaultMessage: '{count, plural, one {# post} other {# posts}}',
  },
});

const TITLE_FOR: Record<string, keyof typeof messages> = {
  about: 'cardAbout',
  interests: 'cardInterests',
  values: 'cardValues',
  exploring: 'cardExploring',
  personality: 'cardPersonality',
  drive: 'cardDrive',
  rotation: 'cardRotation',
  moments: 'cardMoments',
  note: 'cardNote',
  highlights: 'cardHighlights',
  at_a_glance: 'cardAtAGlance',
  open_to: 'cardOpenTo',
  where_i_am: 'cardWhereIAm',
  pod_credentials: 'cardPodCredentials',
};

interface LibraryPresetButtonProps {
  slug: string;
  title: string;
  subtitle: string;
  onPick: (slug: string) => void;
}

const LibraryPresetButton: React.FC<LibraryPresetButtonProps> = ({
  slug,
  title,
  subtitle,
  onPick,
}) => {
  const handleClick = useCallback(() => {
    onPick(slug);
  }, [onPick, slug]);
  return (
    <button
      type='button'
      className='profile-shelves__library-card'
      onClick={handleClick}
    >
      <b>{title}</b>
      <span>{subtitle}</span>
    </button>
  );
};

interface LibraryGridProps {
  library: ApiProfileLibraryJSON;
  onAddCard: (cardType: string) => void;
  onAddSection: (kornerSlug: string) => void;
}

export const LibraryGrid: React.FC<LibraryGridProps> = ({
  library,
  onAddCard,
  onAddSection,
}) => {
  const intl = useIntl();

  const availableTold = library.told.filter((t) => !t.already_added);
  const availableDrawn = library.drawn.filter((d) => !d.already_added);

  if (availableTold.length === 0 && availableDrawn.length === 0) return null;

  return (
    <section className='profile-shelves__library'>
      <h4 className='profile-shelves__library-heading'>
        {intl.formatMessage(messages.add)}
      </h4>
      <div className='profile-shelves__library-grid'>
        {availableTold.map((told) => {
          const messageKey = TITLE_FOR[told.card_type];
          const title = messageKey
            ? intl.formatMessage(messages[messageKey])
            : told.card_type.replaceAll('_', ' ');
          return (
            <LibraryPresetButton
              key={`told-${told.card_type}`}
              slug={told.card_type}
              title={title}
              subtitle={intl.formatMessage(messages.writtenByYou)}
              onPick={onAddCard}
            />
          );
        })}
        {availableDrawn.map((drawn) => (
          <LibraryPresetButton
            key={`drawn-${drawn.korner_slug}`}
            slug={drawn.korner_slug}
            title={drawn.name}
            subtitle={`${drawn.source_label} · ${intl.formatMessage(messages.posts, { count: drawn.count })}`}
            onPick={onAddSection}
          />
        ))}
      </div>
    </section>
  );
};
