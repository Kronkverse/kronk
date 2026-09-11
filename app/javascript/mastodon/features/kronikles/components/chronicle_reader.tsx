import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiDeleteChronicle } from 'mastodon/api/kronikles';
import type { ApiChronicleJSON } from 'mastodon/api_types/kronikles';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { RenderMarkdown } from './render_markdown';

const messages = defineMessages({
  deleteChronicle: {
    id: 'kronikles.reader.delete',
    defaultMessage: 'Delete Kronikle',
  },
  deleteConfirm: {
    id: 'kronikles.reader.delete_confirm',
    defaultMessage: 'Delete this Kronikle? This is permanent.',
  },
  visibilityPublic: {
    id: 'kronikles.reader.visibility_public',
    defaultMessage: 'Kronk',
  },
  visibilityOrbit: {
    id: 'kronikles.reader.visibility_orbit',
    defaultMessage: 'Orbit',
  },
  visibilityMates: {
    id: 'kronikles.reader.visibility_mates',
    defaultMessage: 'Mates',
  },
  visibilitySelfOnly: {
    id: 'kronikles.reader.visibility_self_only',
    defaultMessage: 'Just me',
  },
  kindEssay: { id: 'kronikles.reader.kind_essay', defaultMessage: 'Essay' },
  kindShortStory: {
    id: 'kronikles.reader.kind_short_story',
    defaultMessage: 'Short story',
  },
  kindPoetry: { id: 'kronikles.reader.kind_poetry', defaultMessage: 'Poetry' },
  kindLetter: { id: 'kronikles.reader.kind_letter', defaultMessage: 'Letter' },
  kindJournal: {
    id: 'kronikles.reader.kind_journal',
    defaultMessage: 'Journal',
  },
  kindOther: { id: 'kronikles.reader.kind_other', defaultMessage: 'Other' },
});

const VISIBILITY_LABEL = {
  public: messages.visibilityPublic,
  orbit: messages.visibilityOrbit,
  mates: messages.visibilityMates,
  self_only: messages.visibilitySelfOnly,
} as const;

const KIND_LABEL: Record<ApiChronicleJSON['kind'], typeof messages.kindOther> =
  {
    essay: messages.kindEssay,
    short_story: messages.kindShortStory,
    poetry: messages.kindPoetry,
    letter: messages.kindLetter,
    journal: messages.kindJournal,
    other: messages.kindOther,
  };

interface Props {
  chronicle: ApiChronicleJSON;
  onChange?: (chronicle: ApiChronicleJSON) => void;
}

export const ChronicleReader: React.FC<Props> = ({ chronicle }) => {
  const intl = useIntl();
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    if (deleting) return;
    if (!window.confirm(intl.formatMessage(messages.deleteConfirm))) return;
    setDeleting(true);
    void (async () => {
      try {
        await apiDeleteChronicle(chronicle.id);
        history.replace('/hub/kronikles');
      } catch {
        setDeleting(false);
      }
    })();
  }, [deleting, intl, chronicle.id, history]);

  const ownerAccount = createAccountFromServerJSON(chronicle.owner);

  return (
    <article className='kronikles-reader'>
      <header className='kronikles-reader__header'>
        <h1 className='kronikles-reader__title'>{chronicle.title}</h1>
        <div className='kronikles-reader__meta'>
          <span>{intl.formatMessage(KIND_LABEL[chronicle.kind])}</span>
          <span aria-hidden>·</span>
          <span>
            {intl.formatMessage(VISIBILITY_LABEL[chronicle.visibility])}
          </span>
        </div>
        <div className='kronikles-reader__owner'>
          <Avatar account={ownerAccount} size={24} />
          <span>@{chronicle.owner.acct}</span>
        </div>
      </header>

      <div className='kronikles-reader__body'>
        <RenderMarkdown source={chronicle.body} />
      </div>

      {chronicle.is_owner && (
        <footer className='kronikles-reader__actions'>
          <button
            type='button'
            className='kronikles-reader__delete'
            onClick={handleDelete}
            disabled={deleting}
          >
            {intl.formatMessage(messages.deleteChronicle)}
          </button>
        </footer>
      )}
    </article>
  );
};
