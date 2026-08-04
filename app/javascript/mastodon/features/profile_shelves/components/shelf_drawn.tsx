import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';

// Drawn shelf — a query over the account's posts. MVP-simple: reads
// `settings.render` for the shape, `settings.korner_slug` for the
// binding, and renders a placeholder card that names the shelf +
// source. Real render components (album carousel, track cards, trek
// route lines, longform reader-cards) ship in follow-up PRs — each
// one wires the corresponding statuses endpoint
// (`GET /api/v1/accounts/:id/profile/sections/:section_id/statuses`)
// and swaps the placeholder for the real cards. Backend contract
// (visibility gate + curation) is already stable, so the render
// layer can move independently.

const messages = defineMessages({
  placeholder: {
    id: 'profile_shelves.drawn.placeholder',
    defaultMessage: 'From {source} — coming soon.',
  },
  untitled: {
    id: 'profile_shelves.drawn.untitled',
    defaultMessage: 'Shelf',
  },
});

const SOURCE_LABEL: Record<string, string> = {
  album: 'Albutts',
  track: 'The Booth',
  trek: 'Map',
  listing: 'Wachuneed',
  answers: 'Kuestions',
  longform: 'Long reads',
  photo: 'Photos',
  moment: 'Moments',
  chips: 'Kategory',
  korner: 'Korner',
};

interface ShelfDrawnProps {
  section: ApiProfileSectionJSON;
}

export const ShelfDrawn: React.FC<ShelfDrawnProps> = ({ section }) => {
  const intl = useIntl();
  const settings = section.settings;
  const render =
    typeof settings.render === 'string' ? settings.render : 'korner';
  const source = SOURCE_LABEL[render] ?? render;
  const title =
    section.title ??
    SOURCE_LABEL[render] ??
    intl.formatMessage(messages.untitled);

  return (
    <section
      className={`profile-shelves__shelf profile-shelves__shelf--drawn profile-shelves__shelf--drawn-${render}`}
    >
      <header className='profile-shelves__shelf-head'>
        <h3 className='profile-shelves__shelf-title'>{title}</h3>
        <span className='profile-shelves__shelf-source'>↳ {source}</span>
      </header>
      <div className='profile-shelves__drawn-placeholder'>
        {intl.formatMessage(messages.placeholder, { source })}
      </div>
    </section>
  );
};
