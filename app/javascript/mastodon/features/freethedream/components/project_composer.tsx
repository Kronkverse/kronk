import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiFtdCreateProject,
  apiFtdUpdateProject,
  apiFtdUploadCover,
  FTD_SECTION_ORDER,
} from 'mastodon/api/freethedream';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import type { FtdCover, FtdProject } from 'mastodon/api_types/freethedream';
import { ArrangeList } from 'mastodon/components/arrange_list';
import type { ArrangeItem } from 'mastodon/components/arrange_list';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeSection,
  ComposeTitle,
  ComposeCheck,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { parseKonnectParam, useKonnect } from 'mastodon/hooks/useKonnect';

import { errorOf } from './shared';

const messages = defineMessages({
  chat: { id: 'freethedream.compose.chat', defaultMessage: 'Chat' },
  chatHint: {
    id: 'freethedream.compose.chat_hint',
    defaultMessage:
      'A group chat in Nudges for everyone in the projekt, on its page.',
  },
  pageOrder: {
    id: 'freethedream.compose.page_order',
    defaultMessage: 'Page order',
  },
  pageOrderHint: {
    id: 'freethedream.compose.page_order_hint',
    defaultMessage: 'The order its sections show in on its page.',
  },
  sectionEvents: { id: 'freethedream.events.title', defaultMessage: 'Events' },
  sectionAlbums: {
    id: 'freethedream.albums.title',
    defaultMessage: 'Albums',
  },
  sectionKronikles: {
    id: 'freethedream.kronikles.title',
    defaultMessage: 'Kronikles',
  },
  sectionKuestions: {
    id: 'freethedream.kuestions',
    defaultMessage: 'Kuestions',
  },
  sectionUpdates: {
    id: 'freethedream.activity.title',
    defaultMessage: 'Activity',
  },
  newProject: {
    id: 'freethedream.compose.seed',
    defaultMessage: 'Seed a projekt',
  },
  newPart: {
    id: 'freethedream.compose.gang',
    defaultMessage: 'Add a Komponent',
  },
  editProject: {
    id: 'freethedream.compose.edit_project',
    defaultMessage: 'Edit',
  },
  partSubtitle: {
    id: 'freethedream.compose.gang_subtitle',
    defaultMessage: 'A group for one part of {title}',
  },
  projectSubtitle: {
    id: 'freethedream.compose.project_subtitle',
    defaultMessage:
      'A gathering, a creative work, a tool, an organisation: anything people bring to life together. You run it; people who join add to it.',
  },
  start: { id: 'freethedream.compose.seed_submit', defaultMessage: 'Seed' },
  add: { id: 'freethedream.compose.add', defaultMessage: 'Add' },
  save: { id: 'freethedream.compose.save', defaultMessage: 'Save' },
  saving: { id: 'freethedream.compose.saving', defaultMessage: 'Saving…' },
  name: { id: 'freethedream.compose.name', defaultMessage: 'Name' },
  titlePlaceholder: {
    id: 'freethedream.compose.title_placeholder',
    defaultMessage: 'Title',
  },
  sectionPlaceholder: {
    id: 'freethedream.compose.gang_placeholder',
    defaultMessage: 'Sound, Design, Paperwork',
  },
  cover: { id: 'freethedream.compose.cover', defaultMessage: 'Cover photo' },
  coverAdd: {
    id: 'freethedream.compose.cover_add',
    defaultMessage: 'Choose a photo',
  },
  coverChange: {
    id: 'freethedream.compose.cover_change',
    defaultMessage: 'Change',
  },
  coverRemove: {
    id: 'freethedream.compose.cover_remove',
    defaultMessage: 'Remove',
  },
  uploading: {
    id: 'freethedream.compose.uploading',
    defaultMessage: 'Uploading…',
  },
  about: {
    id: 'freethedream.compose.about',
    defaultMessage: "What it's about",
  },
  ends: { id: 'freethedream.compose.ends', defaultMessage: 'When (optional)' },
  endsHint: {
    id: 'freethedream.compose.ends_hint',
    defaultMessage:
      "A day it happens or is due. Leave it empty if it's ongoing.",
  },
  newFractal: {
    id: 'freethedream.compose.fractal',
    defaultMessage: 'Add a fractal',
  },
  // Seeded from anywhere but a Krew page there is no Krew for it to live
  // in (Tal, 2026-10-31: a projekt is only made from inside a Krew).
  krewNone: {
    id: 'freethedream.compose.krew_none',
    defaultMessage:
      'A projekt lives in a Krew. Seed it from the Krew page, from Konnect.',
  },
});

// What a project draft keeps (docs/design.md, Drafts). The cover photo
// goes as an upload id alongside.
interface ProjectDraftParams {
  title?: string;
  description?: string;
  endsOn?: string;
  konnections?: KonnectTarget[];
}

interface Props {
  // Editing this project or part, or adding a part inside `parent`, or
  // (neither) starting a new project.
  editing?: FtdProject;
  parent?: { id: string; title: string; level: FtdProject['level'] };
  onCancel: () => void;
  onSaved: (project: FtdProject) => void;
}

export const ProjectComposer: React.FC<Props> = ({
  editing,
  parent,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [endsOn, setEndsOn] = useState(editing?.ends_on ?? '');
  const [cover, setCover] = useState<FtdCover | null>(editing?.cover ?? null);
  const [uploading, setUploading] = useState(false);
  // The Krew a new projekt lives in: the one whose page it was seeded from
  // (New projekt, or Konnect's New projekt), so there is nothing to pick.
  // The Konnection is the server's to make, so it isn't made twice.
  const source = useMemo(() => parseKonnectParam(window.location.search), []);
  const krewId = source?.slug === 'krew' ? source.id : '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const top = editing ? editing.top : !parent;
  // Its chat, on and off as a Krew's is in Settings.
  const [chat, setChat] = useState(
    editing ? editing.spaces.includes('nudges') : true,
  );
  const handleChat = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChat(e.target.checked);
  }, []);
  // Its page's sections, in the order they show (a projekt's own, from
  // Edit, like a Krew's Page order): its spaces and its Activity.
  const [order, setOrder] = useState<string[]>(() => {
    if (!editing) return [];
    const keys: string[] = FTD_SECTION_ORDER.filter(
      (key) => key === 'updates' || (editing.spaces as string[]).includes(key),
    );
    const rank = (key: string) => {
      const at = editing.section_order.indexOf(key);
      return at === -1 ? FTD_SECTION_ORDER.length + keys.indexOf(key) : at;
    };
    return [...keys].sort((x, y) => rank(x) - rank(y));
  });
  const sectionNames: Record<string, string> = {
    kalendar: intl.formatMessage(messages.sectionEvents),
    albutts: intl.formatMessage(messages.sectionAlbums),
    kronikles: intl.formatMessage(messages.sectionKronikles),
    kuestions: intl.formatMessage(messages.sectionKuestions),
    nudges: intl.formatMessage(messages.chat),
    updates: intl.formatMessage(messages.sectionUpdates),
  };
  const orderItems: ArrangeItem[] = order.map((key) => ({
    key,
    label: sectionNames[key] ?? key,
  }));
  const newTop = top && !editing;
  // Adding inside an emergence makes a gang; inside a gang, a fractal.
  const fractal = parent?.level === 'gang';
  // What a new one will be Konnected to (decisions.md, 2026-10-23).
  const konnect = useKonnect('freethedream', {
    sourceHandled: source?.slug === 'krew',
  });
  const restoreKonnect = konnect.restore;
  const commitKonnect = konnect.commit;

  // Drafts: what you've written is saved as you go and comes back when
  // the composer opens again: a new emergence on its own, a gang or
  // fractal inside its parent. Editing doesn't.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<ProjectDraftParams> | null) => {
      const p = d?.params ?? {};
      setTitle(p.title ?? '');
      setDescription(p.description ?? '');
      setEndsOn(p.endsOn ?? '');
      restoreKonnect(p.konnections);
      const media = d?.media_attachments[0];
      setCover(
        media
          ? {
              id: media.id,
              url: media.url,
              preview_url: media.preview_url,
            }
          : null,
      );
      setError(null);
    },
    [restoreKonnect],
  );

  const draft = useDraft<ProjectDraftParams>({
    korner: 'freethedream',
    kind: 'project',
    context: parent ? `project:${parent.id}` : null,
    active: !editing,
    snapshot: {
      params: {
        title,
        description,
        endsOn,
        konnections: konnect.saved,
      },
      mediaIds: top && cover ? [cover.id] : [],
    },
    hasContent:
      title.trim() !== '' ||
      description.trim() !== '' ||
      (top && cover !== null),
    apply: applyDraft,
    describe: (d) => d.params.title,
    paused: busy,
  });

  const finishDraft = draft.finish;

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  const handleEnds = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndsOn(e.target.value);
  }, []);
  const handleCoverFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setUploading(true);
      setError(null);
      apiFtdUploadCover(file)
        .then((media) => {
          setCover(media);
          setUploading(false);
        })
        .catch((err: unknown) => {
          setError(errorOf(err));
          setUploading(false);
        });
    },
    [],
  );
  const handleCoverRemove = useCallback(() => {
    setCover(null);
  }, []);
  const handleSubmit = useCallback(() => {
    setBusy(true);
    setError(null);
    const params = {
      title: title.trim(),
      description: description.trim(),
      ...(top
        ? {
            cover_media_attachment_id: cover?.id ?? null,
            ...(editing
              ? { ends_on: endsOn || null, section_order: order, chat }
              : { krew_id: krewId }),
          }
        : {}),
    };
    // Seeded bare (Tal, 2026-10-31): its Komponents and what it needs are
    // added on its page.
    const request = editing
      ? apiFtdUpdateProject(editing.id, params)
      : apiFtdCreateProject({ ...params, parent_id: parent?.id });
    request
      .then(async (project) => {
        if (!editing) {
          finishDraft();
          await commitKonnect('freethedream', project.id);
        }
        onSaved(project);
      })
      .catch((err: unknown) => {
        setError(errorOf(err));
        setBusy(false);
      });
  }, [
    title,
    description,
    endsOn,
    order,
    chat,
    cover,
    krewId,
    top,
    editing,
    parent,
    finishDraft,
    commitKonnect,
    onSaved,
  ]);

  const label = intl.formatMessage(
    editing
      ? messages.editProject
      : fractal
        ? messages.newFractal
        : parent
          ? messages.newPart
          : messages.newProject,
  );
  const subtitle = editing
    ? undefined
    : parent
      ? intl.formatMessage(messages.partSubtitle, { title: parent.title })
      : intl.formatMessage(messages.projectSubtitle);

  return (
    <ComposeShell
      korner='freethedream'
      label={label}
      subtitle={subtitle}
      submitLabel={intl.formatMessage(
        editing ? messages.save : parent ? messages.add : messages.start,
      )}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={
        title.trim().length > 0 && !uploading && (!newTop || krewId !== '')
      }
      onSubmit={handleSubmit}
      onCancel={onCancel}
      draft={draft}
      konnect={editing || parent ? null : konnect}
    >
      <ComposeTitle
        value={title}
        onChange={handleTitle}
        maxLength={120}
        placeholder={intl.formatMessage(
          top ? messages.titlePlaceholder : messages.sectionPlaceholder,
        )}
        aria-label={intl.formatMessage(messages.name)}
      />
      {newTop && krewId === '' && (
        <ComposeHint>{intl.formatMessage(messages.krewNone)}</ComposeHint>
      )}
      <ComposeBody
        value={description}
        onChange={handleDescription}
        maxLength={5000}
        placeholder={intl.formatMessage(messages.about)}
        aria-label={intl.formatMessage(messages.about)}
      />
      {top && (
        <ComposeSection title={intl.formatMessage(messages.cover)}>
          {cover && (
            <img
              className='freethedream-form__cover'
              src={cover.preview_url}
              alt=''
            />
          )}
          <div className='freethedream-form__row'>
            <label className='freethedream__link'>
              {intl.formatMessage(
                uploading
                  ? messages.uploading
                  : cover
                    ? messages.coverChange
                    : messages.coverAdd,
              )}
              <input
                type='file'
                accept='image/*'
                className='freethedream-form__file'
                onChange={handleCoverFile}
                disabled={uploading}
              />
            </label>
            {cover && !uploading && (
              <button
                type='button'
                className='freethedream__link'
                onClick={handleCoverRemove}
              >
                {intl.formatMessage(messages.coverRemove)}
              </button>
            )}
          </div>
        </ComposeSection>
      )}
      {/* A date is set later, from Edit: seeding is bare (Tal,
          2026-10-31). */}
      {top && editing && (
        <ComposeField
          label={intl.formatMessage(messages.ends)}
          hint={intl.formatMessage(messages.endsHint)}
        >
          <ComposeInput type='date' value={endsOn} onChange={handleEnds} />
        </ComposeField>
      )}
      {top && editing && (
        <ComposeCheck
          role='switch'
          label={intl.formatMessage(messages.chat)}
          hint={intl.formatMessage(messages.chatHint)}
          checked={chat}
          onChange={handleChat}
        />
      )}
      {top && editing && orderItems.length > 1 && (
        <ComposeField
          label={intl.formatMessage(messages.pageOrder)}
          hint={intl.formatMessage(messages.pageOrderHint)}
        >
          <ArrangeList items={orderItems} onChange={setOrder} />
        </ComposeField>
      )}
      {error && <ComposeHint error>{error}</ComposeHint>}
    </ComposeShell>
  );
};
