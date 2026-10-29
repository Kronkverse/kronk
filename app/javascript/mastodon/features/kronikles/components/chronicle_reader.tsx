import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { fetchStatus } from 'mastodon/actions/statuses';
import { apiDeleteChronicle } from 'mastodon/api/kronikles';
import type { ApiChronicleJSON } from 'mastodon/api_types/kronikles';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { Avatar } from 'mastodon/components/avatar';
import { StatusEngagement } from 'mastodon/components/status_engagement';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

import { ChapterNav } from './chapter_nav';
import { ChronicleComposer } from './chronicle_composer';
import { RenderMarkdown } from './render_markdown';

const messages = defineMessages({
  editChronicle: {
    id: 'kronikles.page_action.edit',
    defaultMessage: 'Edit Kronikle',
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

export const KIND_LABEL: Record<
  ApiChronicleJSON['kind'],
  typeof messages.kindOther
> = {
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

export const ChronicleReader: React.FC<Props> = ({ chronicle, onChange }) => {
  const intl = useIntl();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const dispatch = useAppDispatch();

  // The Kronikle's Status, for the shared reactions bar below.
  const statusId = chronicle.status_id;
  useEffect(() => {
    if (statusId) dispatch(fetchStatus(statusId, { alsoFetchContext: false }));
  }, [dispatch, statusId]);

  // Edit lives in the Ж menu (docs/design.md): the author gets an Edit
  // Kronikle moon, opening the create composer in edit mode. Delete
  // sits at the foot of that form; there is no inline Edit or Delete.
  const handleStartEdit = useCallback(() => {
    setEditing(true);
  }, []);
  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);
  const handleUpdated = useCallback(
    (updated: ApiChronicleJSON) => {
      onChange?.(updated);
      setEditing(false);
    },
    [onChange],
  );
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.editChronicle),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleStartEdit,
    chronicle.is_owner && !editing,
  );

  const handleDelete = useCallback(() => {
    if (deleting) return;
    confirmThen(intl.formatMessage(messages.deleteConfirm), 'delete', () => {
      setDeleting(true);
      void (async () => {
        try {
          await apiDeleteChronicle(chronicle.id);
          history.replace('/hub/kronikles');
        } catch {
          setDeleting(false);
        }
      })();
    });
  }, [deleting, intl, chronicle.id, history, confirmThen]);

  const ownerAccount = createAccountFromServerJSON(chronicle.owner);

  return (
    <article className='kronikles-reader'>
      {confirmDialog}
      <header className='kronikles-reader__header'>
        <ChapterNav chronicle={chronicle} placement='head' />
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
        <RenderMarkdown source={chronicle.body} pictures={chronicle.pictures} />
      </div>

      {/* The same reactions bar as every other space (StatusEngagement on
          the Kronikle's Status): Reply, Froth, Nudge. Edit stays in the Ж
          menu; the replies are a later step (Kommons "Better formatting for
          posted work"). */}
      {statusId && (
        <StatusEngagement
          statusId={statusId}
          showThread={false}
          className='kronikles-reader__engagement'
          hideEdit
        />
      )}

      <ChapterNav chronicle={chronicle} placement='foot' />

      <AttachmentSection
        korner='kronikles'
        recordId={chronicle.id}
        canManage={chronicle.is_owner}
      />

      {editing && (
        <ChronicleComposer
          chronicle={chronicle}
          onCancel={handleEditCancel}
          onUpdated={handleUpdated}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}
    </article>
  );
};
