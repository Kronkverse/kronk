import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { isAxiosError } from 'axios';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import api, { apiRequestGet } from 'mastodon/api';
import {
  apiContributePhoto,
  apiCreateAlbum,
  apiDeleteAlbum,
  apiDeleteAlbumDraft,
  apiGiveAlbum,
  apiListAlbumDrafts,
  apiSaveAlbumDraft,
  apiUpdateAlbum,
} from 'mastodon/api/albutts';
import type { AlbumDraftBody, ApiAlbumDraftJSON } from 'mastodon/api/albutts';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type {
  AlbumVisibility,
  ApiAlbumJSON,
  KrewAlbumAudience,
} from 'mastodon/api_types/albutts';
import { AccountMultiSelect } from 'mastodon/components/account_multi_select';
import type { AccountLite } from 'mastodon/components/account_multi_select';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';
import { KrewMultiSelect } from 'mastodon/components/krew_multi_select';
import type {
  KrewOption,
  ReachValue,
} from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';

import { CaptionTextarea } from './caption_textarea';

const messages = defineMessages({
  heading: {
    id: 'albutts.composer.heading',
    defaultMessage: 'Start an album',
  },
  editHeading: {
    id: 'albutts.composer.edit_heading',
    defaultMessage: 'Edit album',
  },
  save: {
    id: 'albutts.composer.save',
    defaultMessage: 'Save',
  },
  saveError: {
    id: 'albutts.composer.save_error',
    defaultMessage: "Couldn't save the album — try again.",
  },
  coverLabel: {
    id: 'albutts.composer.cover_label',
    defaultMessage: 'Cover',
  },
  coverHint: {
    id: 'albutts.composer.cover_hint',
    defaultMessage: 'Tap a photo to make it the cover.',
  },
  krewAudience: {
    id: 'albutts.composer.krew_audience',
    defaultMessage: 'Who sees it',
  },
  krewAudienceKrew: {
    id: 'albutts.composer.krew_audience_krew',
    defaultMessage: 'Only {krew}',
  },
  krewAudienceEveryone: {
    id: 'albutts.composer.krew_audience_everyone',
    defaultMessage: 'Everyone on Kronk',
  },
  krewAudienceHidden: {
    id: 'albutts.composer.krew_audience_hidden',
    defaultMessage:
      "{krew} isn't listed in Discover, so its albums stay with the Krew.",
  },
  krewAdds: {
    id: 'albutts.composer.krew_adds',
    defaultMessage:
      "It's {krew}'s album: every member can add photos and edit it.",
  },
  krewNoDelete: {
    id: 'albutts.composer.krew_no_delete',
    defaultMessage:
      "A Krew album can only be deleted by the Krew's last member.",
  },
  give: { id: 'albutts.composer.give', defaultMessage: 'Give to a Krew' },
  giveHint: {
    id: 'albutts.composer.give_hint',
    defaultMessage:
      "It will belong to the Krew: every member can edit it and add photos. You can't take it back.",
  },
  giveConfirm: {
    id: 'albutts.composer.give_confirm',
    defaultMessage:
      "Give this album to {krew}? Every member will be able to edit it and add photos, and you can't take it back.",
  },
  giveError: {
    id: 'albutts.composer.give_error',
    defaultMessage: "Couldn't give the album to the Krew. Try again.",
  },
  deleteAlbum: {
    id: 'albutts.composer.delete',
    defaultMessage: 'Delete album',
  },
  deleteConfirm: {
    id: 'albutts.composer.delete_confirm',
    defaultMessage:
      'Delete this album and every photo in it? This is permanent.',
  },
  deleteError: {
    id: 'albutts.composer.delete_error',
    defaultMessage: "Couldn't delete the album — try again.",
  },
  titleLabel: {
    id: 'albutts.composer.title_label',
    defaultMessage: 'Title',
  },
  titlePlaceholder: {
    id: 'albutts.composer.title_placeholder',
    defaultMessage: 'What is this album?',
  },
  descriptionLabel: {
    id: 'albutts.composer.description_label',
    defaultMessage: 'Description (optional)',
  },
  photosClear: {
    id: 'albutts.composer.photos_clear',
    defaultMessage: 'Clear',
  },
  captionPlaceholder: {
    id: 'albutts.composer.caption_placeholder',
    defaultMessage: 'Add a description (optional)',
  },
  photosPick: {
    id: 'albutts.composer.photos_pick',
    defaultMessage: 'Drag photos or videos here, or click to choose',
  },
  photosPickMore: {
    id: 'albutts.composer.photos_pick_more',
    defaultMessage:
      '{count, plural, one {# selected · drop or click to add more} other {# selected · drop or click to add more}}',
  },
  photosDropCue: {
    id: 'albutts.composer.photos_drop_cue',
    defaultMessage: 'Drop to add',
  },
  create: {
    id: 'albutts.composer.create',
    defaultMessage: 'Create album',
  },
  createWithPhotos: {
    id: 'albutts.composer.create_with_photos',
    defaultMessage:
      'Create album & add {count, plural, one {# photo} other {# photos}}',
  },
  progressLine: {
    id: 'albutts.composer.progress_line',
    defaultMessage:
      '{done} of {total} uploaded{failed, plural, =0 {} one { · # failed} other { · # failed}}',
  },
  rateLimited: {
    id: 'albutts.composer.rate_limited',
    defaultMessage:
      'Upload limit reached. The rest carry on by themselves at {time}; keep this open.',
  },
  retryFailed: {
    id: 'albutts.composer.retry_failed',
    defaultMessage: 'Retry {count} failed',
  },
  error: {
    id: 'albutts.composer.error',
    defaultMessage: "Couldn't create the album — try again.",
  },
  photoErrorPartial: {
    id: 'albutts.composer.photo_error_partial',
    defaultMessage:
      "The album is created, but {failed, plural, one {# photo} other {# photos}} didn't upload. Retry them below or continue and add later.",
  },
  continueToAlbum: {
    id: 'albutts.composer.continue_to_album',
    defaultMessage: 'Continue to album',
  },
  chipQueued: {
    id: 'albutts.composer.chip_queued',
    defaultMessage: 'Queued',
  },
  chipUploading: {
    id: 'albutts.composer.chip_uploading',
    defaultMessage: 'Uploading…',
  },
  chipDone: {
    id: 'albutts.composer.chip_done',
    defaultMessage: 'Uploaded',
  },
  chipFailed: {
    id: 'albutts.composer.chip_failed',
    defaultMessage: 'Failed',
  },
  chipUploaded: {
    id: 'albutts.composer.chip_uploaded',
    defaultMessage: 'Saved in your draft',
  },
  chipAdding: {
    id: 'albutts.composer.chip_adding',
    defaultMessage: 'Adding to the album…',
  },
  draftsLabel: {
    id: 'albutts.composer.drafts_label',
    defaultMessage: 'Drafts',
  },
  draftsHint: {
    id: 'albutts.composer.drafts_hint',
    defaultMessage:
      'Your album saves as you go, photos too. Leave and come back any time.',
  },
  draftUntitled: {
    id: 'albutts.composer.draft_untitled',
    defaultMessage: 'Untitled',
  },
  draftChip: {
    id: 'albutts.composer.draft_chip',
    defaultMessage: '{title} · {count, plural, one {# photo} other {# photos}}',
  },
  startAnother: {
    id: 'albutts.composer.start_another',
    defaultMessage: 'Start another album',
  },
  discardDraft: {
    id: 'albutts.composer.discard_draft',
    defaultMessage: 'Discard draft',
  },
  discardDraftConfirm: {
    id: 'albutts.composer.discard_draft_confirm',
    defaultMessage:
      'Discard this draft and the photos uploaded to it? This is permanent.',
  },
  uploadingWait: {
    id: 'albutts.composer.uploading_wait',
    defaultMessage: 'Uploading {done} of {total}…',
  },
  uploadFailed: {
    id: 'albutts.composer.upload_failed',
    defaultMessage:
      "{failed, plural, one {# photo} other {# photos}} didn't upload. Retry, or create the album without {failed, plural, one {it} other {them}}.",
  },
  retryUploads: {
    id: 'albutts.composer.retry_uploads',
    defaultMessage: 'Retry {count} failed',
  },
  // Contribution — Album's "who can add photos to this album?" question.
  // Not part of the standard visibility picker (that's reach + krews
  // only, in the shell header); Album is the one composer today that
  // needs a second axis on top of reach.
  contributionHeading: {
    id: 'albutts.composer.contribution_heading',
    defaultMessage: 'Who can add photos',
  },
  contributionOpen: {
    id: 'albutts.composer.contribution_open',
    defaultMessage: 'Anyone who can see it can add',
  },
  contributionRestricted: {
    id: 'albutts.composer.contribution_restricted',
    defaultMessage: 'Only people I choose can add',
  },
  contributorKrews: {
    id: 'albutts.composer.contributor_krews',
    defaultMessage: 'Krews who can add',
  },
  contributorPeople: {
    id: 'albutts.composer.contributor_people',
    defaultMessage: 'People who can add',
  },
  contributionSelfOnlyNote: {
    id: 'albutts.composer.contribution_self_only_note',
    defaultMessage: 'Only you can add to a just-me album.',
  },
  krewsEmpty: {
    id: 'albutts.composer.krews_empty',
    defaultMessage: 'You’re not in any krews yet.',
  },
});

const TITLE_MAX = 240;
const DESCRIPTION_MAX = 4000;
// Rungs Albutts offers on the standard `<ReachDropdown>` in the shell
// header. Krew is not a rung — it's the additive audience axis the
// dropdown grows a submenu for (docs/decisions.md).
const REACH_LADDER: readonly ReachValue[] = [
  'self_only',
  'mates',
  'orbit',
  'public',
];
// Concurrency cap on the upload pool. Four keeps browser socket count
// reasonable (major browsers cap ~6 per host) and matches the load
// Mastodon media processing can absorb without queue backup.
const UPLOAD_CONCURRENCY = 4;

// When the server says "too many uploads" (HTTP 429, rack-attack's
// throttle_api_media), the pool waits until the window resets and tries
// the same photo again instead of failing it. Big event albums used to
// need splitting by hand and a half-hour wait between batches (Kommons
// #117379650134198491). A photo gives up after this many waits.
const MAX_RATE_LIMIT_WAITS = 6;
// Fallback wait when the reset header is missing or unreadable, and the
// ceiling on any wait (the throttle period is 30 minutes).
const DEFAULT_RATE_LIMIT_WAIT_MS = 60_000;
const MAX_RATE_LIMIT_WAIT_MS = 31 * 60_000;

// Milliseconds until the throttle resets, from rack-attack's
// X-RateLimit-Reset header (an ISO timestamp), or null when the error is
// not a 429.
const rateLimitWaitMs = (e: unknown): number | null => {
  if (!isAxiosError(e) || e.response?.status !== 429) return null;
  const header: unknown = e.response.headers['x-ratelimit-reset'];
  const resetAt = typeof header === 'string' ? Date.parse(header) : NaN;
  const wait = Number.isFinite(resetAt)
    ? resetAt - Date.now() + 1000
    : DEFAULT_RATE_LIMIT_WAIT_MS;
  return Math.min(Math.max(wait, 1000), MAX_RATE_LIMIT_WAIT_MS);
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

interface MediaResponse {
  id: string;
}

// Two modes. Without `album` it starts a new album (and uploads its first
// photos). With `album` it edits that album: the same fields, filled in,
// plus the cover and Delete album; photos are added from the album page.
// Edit is the owner's Ж-menu moon on the album page (docs/design.md).
interface AlbumComposerProps {
  onCancel: () => void;
  onCreated?: (album: ApiAlbumJSON) => void;
  album?: ApiAlbumJSON;
  onSaved?: (album: ApiAlbumJSON) => void;
  onDeleted?: () => void;
  // Make a Krew album in this Krew (docs/spaces/albutts.md, Krew albums).
  krew?: ComposerKrew;
}

interface ComposerKrew {
  id: string;
  name: string;
  listed: boolean;
}

// A photo uploads as soon as it's added (queued → uploading → uploaded),
// so it's on the server and in the draft before the album exists. Creating
// the album adds the uploads to it (adding → done). `failed` without a
// `mediaId` failed to upload; with one, failed to be added.
type PhotoStatus =
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'adding'
  | 'done'
  | 'failed';

interface PhotoDraft {
  // Absent for a photo restored from a saved draft: it's already uploaded.
  file?: File;
  previewUrl: string;
  key: string;
  status: PhotoStatus;
  caption: string;
  mediaId?: string;
}

const photosFromDraft = (draft: ApiAlbumDraftJSON): PhotoDraft[] =>
  draft.media_attachments.map((m) => ({
    previewUrl: m.preview_url,
    key: `draft-${m.id}`,
    status: 'uploaded',
    caption: draft.params.captions?.[m.id] ?? '',
    mediaId: m.id,
  }));

const CAPTION_MAX = 500;

export const AlbumComposer: React.FC<AlbumComposerProps> = ({
  onCancel,
  onCreated,
  album: editing,
  onSaved,
  onDeleted,
  krew: newForKrew,
}) => {
  const intl = useIntl();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [visibility, setVisibility] = useState<AlbumVisibility>(
    editing?.visibility ?? 'mates',
  );
  // Contribution: open (anyone who can see it) vs a restricted roster of
  // krews ∪ people (docs/spaces/albutts.md, additive roster).
  const [contributionOpen, setContributionOpen] = useState(
    editing?.contribution_open ?? true,
  );
  const [audienceKrewIds, setAudienceKrewIds] = useState<string[]>(
    editing?.krews?.map((k) => k.id) ?? [],
  );
  const [contributorKrewIds, setContributorKrewIds] = useState<string[]>(
    editing?.contributor_krew_ids ?? [],
  );
  const [contributorAccounts, setContributorAccounts] = useState<AccountLite[]>(
    [],
  );
  const [coverId, setCoverId] = useState<string | null>(
    editing?.cover_media_attachment_id ?? null,
  );
  // A Krew album, being made from a Krew's page or edited. It is seen by the
  // Krew or by everyone, and its members add, so that one choice replaces
  // reach, Krews and who can add. It isn't kept as a draft.
  const forKrew = useMemo<ComposerKrew | undefined>(() => {
    if (newForKrew) return newForKrew;
    const k = editing?.krew_id
      ? editing.krews?.find((x) => x.id === editing.krew_id)
      : undefined;
    return k
      ? { id: k.id, name: k.name, listed: k.listed ?? false }
      : undefined;
  }, [newForKrew, editing]);
  const [audience, setAudience] = useState<KrewAlbumAudience>(
    editing?.audience ?? 'krew',
  );
  const [giving, setGiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<'save' | 'delete' | 'give' | null>(
    null,
  );

  // The album only carries the invited people's ids; the picker needs
  // their names, so look them up once when editing.
  const invitedIds = editing?.invited_contributor_ids;
  // Until the names are in, Save leaves the people roster alone rather
  // than sending an empty one (which would remove everyone).
  const [rosterLoaded, setRosterLoaded] = useState(
    !invitedIds || invitedIds.length === 0,
  );
  useEffect(() => {
    if (!invitedIds || invitedIds.length === 0) return;
    let cancelled = false;
    apiRequestGet<ApiAccountJSON[]>('v1/accounts', { id: invitedIds })
      .then((accounts) => {
        if (cancelled) return;
        setContributorAccounts(
          accounts.map((a) => ({
            id: a.id,
            acct: a.acct,
            displayName: a.display_name || a.username,
          })),
        );
        setRosterLoaded(true);
      })
      .catch(() => {
        // Leave `rosterLoaded` false: Save keeps the roster as it is.
      });
    return () => {
      cancelled = true;
    };
  }, [invitedIds]);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAlbum, setCreatedAlbum] = useState<ApiAlbumJSON | null>(null);
  const [dragging, setDragging] = useState(false);

  // Drafts (docs/spaces/albutts.md, Drafts). A new album saves its whole
  // state to the server as you go, photos included: they upload as soon
  // as they're added. Navigating away loses nothing, and "Start another
  // album" leaves this one in your drafts. Opening the composer picks up
  // the newest draft. Before, only the title and description survived
  // (in this browser), and photos were lost.
  const [drafts, setDrafts] = useState<ApiAlbumDraftJSON[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftsLoaded, setDraftsLoaded] = useState(!!editing || !!newForKrew);
  const draftIdRef = useRef<string | null>(null);
  const lastSavedRef = useRef('');
  const pendingBodyRef = useRef<AlbumDraftBody | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const draftBody = useMemo<AlbumDraftBody>(
    () => ({
      title,
      description,
      visibility,
      contribution_open: contributionOpen,
      krew_ids: audienceKrewIds,
      contributor_krew_ids: contributorKrewIds,
      contributor_accounts: contributorAccounts.map((a) => ({
        id: a.id,
        acct: a.acct,
        display_name: a.displayName,
      })),
      captions: Object.fromEntries(
        photos.flatMap((p) => (p.mediaId ? [[p.mediaId, p.caption]] : [])),
      ),
      media_ids: photos.flatMap((p) => (p.mediaId ? [p.mediaId] : [])),
    }),
    [
      title,
      description,
      visibility,
      contributionOpen,
      audienceKrewIds,
      contributorKrewIds,
      contributorAccounts,
      photos,
    ],
  );
  const hasContent =
    title.trim() !== '' ||
    description.trim() !== '' ||
    photos.some((p) => p.mediaId);

  // Saves run one at a time, so the first save's new id is known before
  // the next one, and a draft is never created twice.
  const flushDraft = useCallback(() => {
    const body = pendingBodyRef.current;
    if (!body) return saveChainRef.current;
    pendingBodyRef.current = null;
    const run = saveChainRef.current.then(async () => {
      const json = JSON.stringify(body);
      if (json === lastSavedRef.current) return;
      const saved = await apiSaveAlbumDraft(draftIdRef.current, body);
      draftIdRef.current = saved.id;
      lastSavedRef.current = json;
      setDraftId(saved.id);
      setDrafts((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);
    });
    saveChainRef.current = run.catch((e: unknown) => {
      console.error('[albutts] saving the draft failed', e);
    });
    return saveChainRef.current;
  }, []);

  useEffect(() => {
    if (editing || newForKrew || createdAlbum || pending || !draftsLoaded)
      return;
    if (!hasContent && !draftIdRef.current) return;
    pendingBodyRef.current = draftBody;
    const timer = setTimeout(() => void flushDraft(), 800);
    return () => {
      clearTimeout(timer);
    };
  }, [
    draftBody,
    hasContent,
    editing,
    newForKrew,
    createdAlbum,
    pending,
    draftsLoaded,
    flushDraft,
  ]);

  // Leaving with unsaved changes saves them on the way out.
  useEffect(
    () => () => {
      void flushDraft();
    },
    [flushDraft],
  );

  const loadDraft = useCallback((d: ApiAlbumDraftJSON | null) => {
    const p = d?.params ?? {};
    setTitle(p.title ?? '');
    setDescription(p.description ?? '');
    setVisibility(p.visibility ?? 'mates');
    setContributionOpen(p.contribution_open ?? true);
    setAudienceKrewIds(p.krew_ids ?? []);
    setContributorKrewIds(p.contributor_krew_ids ?? []);
    setContributorAccounts(
      (p.contributor_accounts ?? []).map((a) => ({
        id: a.id,
        acct: a.acct,
        displayName: a.display_name,
      })),
    );
    setPhotos(d ? photosFromDraft(d) : []);
    draftIdRef.current = d?.id ?? null;
    lastSavedRef.current = '';
    setDraftId(d?.id ?? null);
  }, []);

  useEffect(() => {
    if (editing || newForKrew) return;
    let cancelled = false;
    apiListAlbumDrafts()
      .then((list) => {
        if (cancelled) return;
        setDrafts(list);
        if (list[0]) loadDraft(list[0]);
      })
      .catch(() => {
        // No drafts to offer; the composer still saves new ones.
      })
      .finally(() => {
        if (!cancelled) setDraftsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, newForKrew, loadDraft]);

  const switchDraft = useCallback(
    (d: ApiAlbumDraftJSON | null) => {
      pendingBodyRef.current = hasContent ? draftBody : null;
      void flushDraft().then(() => {
        loadDraft(d);
      });
    },
    [hasContent, draftBody, flushDraft, loadDraft],
  );

  const handleStartAnother = useCallback(() => {
    switchDraft(null);
  }, [switchDraft]);

  const forgetDraft = useCallback(() => {
    const id = draftIdRef.current;
    pendingBodyRef.current = null;
    draftIdRef.current = null;
    setDraftId(null);
    if (!id) return;
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    void saveChainRef.current
      .then(() => apiDeleteAlbumDraft(id))
      .catch(() => {
        // Left behind, it's just a draft you can discard later.
      });
  }, []);

  const handleDiscardDraft = useCallback(() => {
    confirmThen(
      intl.formatMessage(messages.discardDraftConfirm),
      'delete',
      () => {
        forgetDraft();
        loadDraft(null);
      },
    );
  }, [confirmThen, intl, forgetDraft, loadDraft]);

  // Revoke the previews' blob URLs when the composer closes, so the
  // browser lets go of the files. Not on every change to `photos`: photos
  // now change status while uploading, and revoking then broke previews
  // that hadn't loaded yet. Restored photos show the server's preview.
  const blobUrlsRef = useRef(new Set<string>());
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((u) => {
        URL.revokeObjectURL(u);
      });
    };
  }, []);

  const trimmed = title.trim();
  const uploadingCount = photos.filter(
    (p) => p.status === 'queued' || p.status === 'uploading',
  ).length;
  // A new album waits for its photos to finish uploading.
  const canSubmit =
    trimmed !== '' && !pending && (!!editing || uploadingCount === 0);

  // Set while the pool is paused on the upload throttle; drives the
  // "carrying on at …" line.
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const doneCount = photos.filter((p) => p.status === 'done').length;
  const failedCount = photos.filter((p) => p.status === 'failed').length;
  const inflightCount = photos.filter((p) => p.status === 'adding').length;
  const uploadFailedCount = photos.filter(
    (p) => p.status === 'failed' && !p.mediaId,
  ).length;

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.slice(0, TITLE_MAX));
  }, []);

  const handleVisibilityChange = useCallback((next: ReachValue) => {
    setVisibility(next as AlbumVisibility);
  }, []);

  const handleToggleAudienceKrew = useCallback((id: string) => {
    setAudienceKrewIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    // If a krew leaves the audience it can't remain a contributor (you must
    // be able to see an album to add to it). No-op when adding.
    setContributorKrewIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const handleToggleContributorKrew = useCallback((id: string) => {
    setContributorKrewIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    // A contributor krew is always also an audience krew.
    setAudienceKrewIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const handleContributionOpen = useCallback(() => {
    setContributionOpen(true);
  }, []);
  const handleContributionRestricted = useCallback(() => {
    setContributionOpen(false);
  }, []);

  const handleContributorAccountsChange = useCallback((next: AccountLite[]) => {
    setContributorAccounts(next);
  }, []);

  // Accept only images and videos. Drag-and-drop hands us the entire
  // OS clipboard including e.g. text/uri-list, so filter to media types
  // before enqueueing.
  // Move a photo through the status machine. Reads by key so
  // concurrent workers don't stomp on each other's indices.
  const setPhotoStatus = useCallback((key: string, status: PhotoStatus) => {
    setPhotos((prev) =>
      prev.map((p) => (p.key === key ? { ...p, status } : p)),
    );
  }, []);

  // Uploads start as photos are added (UPLOAD_CONCURRENCY at a time), so
  // they're saved in the draft long before the album is created.
  const uploadQueueRef = useRef<PhotoDraft[]>([]);
  const activeUploadsRef = useRef(0);
  const pausedUntilRef = useRef(0);

  const waitOutPause = useCallback(async () => {
    while (Date.now() < pausedUntilRef.current) {
      await sleep(pausedUntilRef.current - Date.now());
    }
  }, []);

  // Waits out the upload throttle (HTTP 429) and tries again, up to
  // MAX_RATE_LIMIT_WAITS times; any other error is thrown.
  const withThrottle = useCallback(
    async <T,>(request: () => Promise<T>): Promise<T> => {
      for (let waits = 0; ; waits++) {
        await waitOutPause();
        try {
          return await request();
        } catch (e) {
          const wait = rateLimitWaitMs(e);
          if (wait === null || waits >= MAX_RATE_LIMIT_WAITS) throw e;
          pausedUntilRef.current = Math.max(
            pausedUntilRef.current,
            Date.now() + wait,
          );
          setRateLimitedUntil(pausedUntilRef.current);
        }
      }
    },
    [waitOutPause],
  );

  const uploadOne = useCallback(
    async (draft: PhotoDraft) => {
      const file = draft.file;
      if (!file) return;
      setPhotoStatus(draft.key, 'uploading');
      try {
        const media = await withThrottle(() => {
          const form = new FormData();
          form.append('file', file);
          return api().post<MediaResponse>('/api/v1/media', form);
        });
        setPhotos((prev) =>
          prev.map((p) =>
            p.key === draft.key
              ? { ...p, status: 'uploaded', mediaId: media.data.id }
              : p,
          ),
        );
      } catch (e) {
        console.error(
          '[albutts] photo upload failed',
          { name: file.name, size: file.size, type: file.type },
          e,
        );
        setPhotoStatus(draft.key, 'failed');
      }
    },
    [setPhotoStatus, withThrottle],
  );

  const pumpUploads = useCallback(() => {
    while (
      activeUploadsRef.current < UPLOAD_CONCURRENCY &&
      uploadQueueRef.current.length > 0
    ) {
      const next = uploadQueueRef.current.shift();
      if (!next) break;
      activeUploadsRef.current += 1;
      void uploadOne(next).finally(() => {
        activeUploadsRef.current -= 1;
        if (
          activeUploadsRef.current === 0 &&
          uploadQueueRef.current.length === 0
        )
          setRateLimitedUntil(null);
        pumpUploads();
      });
    }
  }, [uploadOne]);

  const queueUploads = useCallback(
    (drafts: PhotoDraft[]) => {
      uploadQueueRef.current.push(...drafts);
      pumpUploads();
    },
    [pumpUploads],
  );

  const trackBlobUrl = (url: string) => {
    blobUrlsRef.current.add(url);
    return url;
  };

  const addPhotoFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
      );
      if (accepted.length === 0) return;
      const added = accepted.map((file, idx) => ({
        file,
        previewUrl: trackBlobUrl(URL.createObjectURL(file)),
        key: `${Date.now()}-${idx}-${file.name}`,
        status: 'queued' as PhotoStatus,
        caption: '',
      }));
      setPhotos((prev) => [...prev, ...added]);
      queueUploads(added);
    },
    [queueUploads],
  );

  const handleCaptionChange = useCallback((key: string, value: string) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.key === key ? { ...p, caption: value.slice(0, CAPTION_MAX) } : p,
      ),
    );
  }, []);

  const handlePhotosChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      addPhotoFiles(files);
      e.target.value = ''; // allow re-picking the same file
    },
    [addPhotoFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addPhotoFiles(Array.from(e.dataTransfer.files));
    },
    [addPhotoFiles],
  );

  const handleClearPhotos = useCallback(() => {
    uploadQueueRef.current = [];
    setPhotos([]);
  }, []);

  // Adds the uploaded photos to the new album, UPLOAD_CONCURRENCY at a
  // time. A photo whose upload failed is uploaded again first.
  const addToAlbum = useCallback(
    async (albumId: string, drafts: PhotoDraft[]) => {
      const queue: PhotoDraft[] = [...drafts];

      const addOne = async (draft: PhotoDraft) => {
        let mediaId = draft.mediaId;
        if (!mediaId) {
          const file = draft.file;
          if (!file) throw new Error('nothing to upload');
          const media = await withThrottle(() => {
            const form = new FormData();
            form.append('file', file);
            return api().post<MediaResponse>('/api/v1/media', form);
          });
          mediaId = media.data.id;
          const uploaded = mediaId;
          setPhotos((prev) =>
            prev.map((p) =>
              p.key === draft.key ? { ...p, mediaId: uploaded } : p,
            ),
          );
        }
        const id = mediaId;
        await withThrottle(() =>
          apiContributePhoto(albumId, {
            media_id: id,
            caption: draft.caption.trim() || undefined,
          }),
        );
      };

      const worker = async () => {
        while (queue.length > 0) {
          const draft = queue.shift();
          if (!draft) return;
          setPhotoStatus(draft.key, 'adding');
          try {
            await addOne(draft);
            setPhotoStatus(draft.key, 'done');
          } catch (e) {
            console.error('[albutts] adding a photo failed', e);
            setPhotoStatus(draft.key, 'failed');
          }
        }
      };

      const workers = Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, drafts.length) },
        () => worker(),
      );
      await Promise.all(workers);
      setRateLimitedUntil(null);
    },
    [setPhotoStatus, withThrottle],
  );

  const saveEdit = useCallback(() => {
    if (!editing || !canSubmit) return;
    setPending(true);
    setSaveError(null);
    void (async () => {
      try {
        const updated = forKrew
          ? await apiUpdateAlbum(editing.id, {
              title: trimmed,
              description: description.trim(),
              cover_media_attachment_id: coverId ?? undefined,
              audience,
            })
          : await apiUpdateAlbum(editing.id, {
              title: trimmed,
              description: description.trim(),
              contribution: contributionOpen ? 'open' : 'invited',
              cover_media_attachment_id: coverId ?? undefined,
              // Reach isn't sent: it's fixed once the album exists (see the
              // ReachDropdown below). Audience Krews go back as they were,
              // plus any newly chosen contributor Krew, which has to be able
              // to see the album to add to it.
              krew_ids: audienceKrewIds,
              contributor_krew_ids: contributionOpen ? [] : contributorKrewIds,
              contributor_account_ids: !rosterLoaded
                ? undefined
                : contributionOpen
                  ? []
                  : contributorAccounts.map((a) => a.id),
            });
        onSaved?.(updated);
      } catch (e) {
        console.error('[albutts] update album failed', e);
        setSaveError('save');
        setPending(false);
      }
    })();
  }, [
    editing,
    canSubmit,
    trimmed,
    description,
    contributionOpen,
    coverId,
    audienceKrewIds,
    contributorKrewIds,
    rosterLoaded,
    contributorAccounts,
    onSaved,
    forKrew,
    audience,
  ]);

  // Give this personal album to a Krew you're in. One way.
  const handleGive = useCallback(
    (krewId: string, krewName: string) => {
      if (!editing || giving) return;
      confirmThen(
        intl.formatMessage(messages.giveConfirm, { krew: krewName }),
        'confirm',
        () => {
          setGiving(true);
          setSaveError(null);
          apiGiveAlbum(editing.id, krewId)
            .then((updated) => {
              onSaved?.(updated);
            })
            .catch(() => {
              setSaveError('give');
              setGiving(false);
            });
        },
      );
    },
    [editing, giving, intl, onSaved, confirmThen],
  );

  // Delete lives inside the edit form, not on the page or as its own
  // moon (Tal, 2026-10-11; docs/decisions.md).
  const handleDelete = useCallback(() => {
    if (!editing || deleting) return;
    confirmThen(intl.formatMessage(messages.deleteConfirm), 'delete', () => {
      setDeleting(true);
      setSaveError(null);
      void (async () => {
        try {
          await apiDeleteAlbum(editing.id);
          onDeleted?.();
        } catch {
          setSaveError('delete');
          setDeleting(false);
        }
      })();
    });
  }, [editing, deleting, intl, onDeleted, confirmThen]);

  const pickCover = useCallback((mediaId: string) => {
    setCoverId(mediaId);
  }, []);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    void (async () => {
      let album: ApiAlbumJSON;
      try {
        album = forKrew
          ? await apiCreateAlbum({
              title: trimmed,
              description: description.trim() || undefined,
              krew_id: forKrew.id,
              audience,
            })
          : await apiCreateAlbum({
              title: trimmed,
              description: description.trim() || undefined,
              visibility,
              // The `contribution` enum only needs to encode open vs restricted;
              // the roster arrays carry the detail.
              contribution: contributionOpen ? 'open' : 'invited',
              krew_ids: audienceKrewIds,
              contributor_krew_ids: contributionOpen ? [] : contributorKrewIds,
              contributor_account_ids: contributionOpen
                ? []
                : contributorAccounts.map((a) => a.id),
            });
      } catch (e) {
        console.error('[albutts] create album failed', e);
        setError('create_failed');
        setPending(false);
        return;
      }

      setCreatedAlbum(album);
      forgetDraft();

      // Photos that never uploaded stay out; Retry adds them later.
      await addToAlbum(
        album.id,
        photos.filter((p) => p.mediaId),
      );

      setPending(false);
    })();
  }, [
    canSubmit,
    contributionOpen,
    contributorKrewIds,
    contributorAccounts,
    description,
    audienceKrewIds,
    photos,
    addToAlbum,
    trimmed,
    visibility,
    forgetDraft,
    forKrew,
    audience,
  ]);

  // Retry the failed photos: before the album exists, upload them again;
  // after, upload (if needed) and add them.
  const handleRetryFailed = useCallback(() => {
    const failed = photos.filter((p) => p.status === 'failed');
    if (failed.length === 0) return;
    if (!createdAlbum) {
      const again = failed.filter((p) => !p.mediaId);
      again.forEach((p) => {
        setPhotoStatus(p.key, 'queued');
      });
      queueUploads(again);
      return;
    }
    setPending(true);
    void (async () => {
      await addToAlbum(createdAlbum.id, failed);
      setPending(false);
    })();
  }, [createdAlbum, photos, addToAlbum, queueUploads, setPhotoStatus]);

  const handleContinue = useCallback(() => {
    if (createdAlbum) onCreated?.(createdAlbum);
  }, [createdAlbum, onCreated]);

  // Auto-close the composer when a submit finished successfully with
  // zero failures. If any failed, we stay open so the user can retry
  // or continue on their own terms.
  useEffect(() => {
    if (!createdAlbum) return;
    if (pending) return;
    if (
      failedCount === 0 &&
      (photos.length === 0 || doneCount === photos.length)
    ) {
      onCreated?.(createdAlbum);
    }
  }, [createdAlbum, doneCount, failedCount, onCreated, pending, photos.length]);

  const readyCount = photos.filter((p) => p.mediaId).length;
  const submitLabel =
    uploadingCount > 0
      ? intl.formatMessage(messages.uploadingWait, {
          done: readyCount,
          total: photos.length,
        })
      : readyCount === 0
        ? intl.formatMessage(messages.create)
        : intl.formatMessage(messages.createWithPhotos, { count: readyCount });

  // Shell primary-CTA + submit handler depend on which phase we're in:
  //   * Phase 1 (composing) — "Create album" (± "with N photos"),
  //     submit triggers apiCreateAlbum + queues uploads.
  //   * Phase 2 (created, uploads running) — "Continue to album",
  //     submit navigates to the new album detail. Retry-failed is
  //     rendered inline in the body when there's something to retry.
  const shellSubmitLabel = editing
    ? intl.formatMessage(messages.save)
    : createdAlbum
      ? intl.formatMessage(messages.continueToAlbum)
      : submitLabel;
  const shellSubmit = editing
    ? saveEdit
    : createdAlbum
      ? handleContinue
      : submit;
  const shellCanSubmit = editing
    ? canSubmit && !deleting
    : createdAlbum
      ? !pending
      : canSubmit;

  // Standard visibility picker for every composer: `<ReachDropdown>`
  // in the shell header. Same pattern Moments / Kalendar / Trek use;
  // Album adopted 2026-09-09 (Tal — "the scope picker becomes a
  // normal part of the standard composer"). Reach + krews only —
  // Album's "who can add" (contribution) is a separate axis that
  // stays inline in the body below, because it's Album-specific
  // rather than a universal composer concern.
  const availableKrews = useAvailableKrews();
  const reachValue: ReachValue = REACH_LADDER.includes(visibility as ReachValue)
    ? (visibility as ReachValue)
    : 'public';
  const reachControl = (
    <ReachDropdown
      value={reachValue}
      onChange={handleVisibilityChange}
      // Reach is fixed once the album exists: changing it wouldn't
      // re-scope the photo posts already in it (docs/spaces/albutts.md,
      // Open questions), so narrowing it would only look private. Editing
      // offers just the album's own rung. Krews can still be added or
      // taken off: the server moves the album's posts with them
      // (Kronk::StatusKrews; docs/spaces/krew.md, Linking).
      disabled={!!createdAlbum}
      hide={
        editing ? REACH_LADDER.filter((rung) => rung !== reachValue) : undefined
      }
      krews={availableKrews}
      selectedKrewIds={audienceKrewIds}
      onToggleKrew={handleToggleAudienceKrew}
    />
  );
  const isSelfOnly = reachValue === 'self_only';

  return (
    <ComposeShell
      korner='albutts'
      label={intl.formatMessage(
        editing ? messages.editHeading : messages.heading,
      )}
      submitLabel={shellSubmitLabel}
      submitting={pending}
      canSubmit={shellCanSubmit}
      onSubmit={shellSubmit}
      onCancel={onCancel}
      headerAction={forKrew ? undefined : reachControl}
    >
      {confirmDialog}
      <div className='albutts-composer'>
        {!editing &&
          !newForKrew &&
          !createdAlbum &&
          (drafts.length > 0 || draftId) && (
            <div className='albutts-composer__drafts'>
              <div className='albutts-composer__label'>
                {intl.formatMessage(messages.draftsLabel)}
              </div>
              <p className='albutts-composer__note'>
                {intl.formatMessage(messages.draftsHint)}
              </p>
              <ul className='albutts-composer__draft-list'>
                {drafts.map((d) => (
                  <DraftChip
                    key={d.id}
                    draft={d}
                    active={d.id === draftId}
                    disabled={pending || uploadingCount > 0}
                    onPick={switchDraft}
                    label={intl.formatMessage(messages.draftChip, {
                      title: d.params.title?.trim()
                        ? d.params.title.trim()
                        : intl.formatMessage(messages.draftUntitled),
                      count: d.media_attachments.length,
                    })}
                  />
                ))}
              </ul>
              <div className='albutts-composer__inline-actions'>
                {hasContent && (
                  <button
                    type='button'
                    className='albutts-btn albutts-btn--ghost'
                    onClick={handleStartAnother}
                    disabled={pending || uploadingCount > 0}
                  >
                    {intl.formatMessage(messages.startAnother)}
                  </button>
                )}
                {draftId && (
                  <button
                    type='button'
                    className='albutts-composer__clear'
                    onClick={handleDiscardDraft}
                    disabled={pending || uploadingCount > 0}
                  >
                    {intl.formatMessage(messages.discardDraft)}
                  </button>
                )}
              </div>
            </div>
          )}
        <label
          className='albutts-composer__label'
          htmlFor='albutts-composer-title'
        >
          {intl.formatMessage(messages.titleLabel)}
        </label>
        <input
          id='albutts-composer-title'
          type='text'
          className='albutts-composer__input'
          value={title}
          onChange={handleTitle}
          maxLength={TITLE_MAX}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
          disabled={!!createdAlbum}
        />

        <label
          className='albutts-composer__label'
          htmlFor='albutts-composer-description'
        >
          {intl.formatMessage(messages.descriptionLabel)}
        </label>
        {/* The caption box, for its @name suggestions: someone named here
            is told, and the name links to them on the album. */}
        <CaptionTextarea
          id='albutts-composer-description'
          className='albutts-composer__textarea'
          value={description}
          onChange={setDescription}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          disabled={!!createdAlbum}
        />

        {editing && editing.photos.length > 0 && (
          <CoverPicker
            photos={editing.photos}
            coverId={
              coverId ?? editing.photos[0]?.status.media_attachments[0]?.id
            }
            onPick={pickCover}
            label={intl.formatMessage(messages.coverLabel)}
            hint={intl.formatMessage(messages.coverHint)}
          />
        )}

        {!createdAlbum && !editing && (
          <div
            className={`albutts-composer__drop-zone${dragging ? ' albutts-composer__drop-zone--dragging' : ''}${pending ? ' albutts-composer__drop-zone--disabled' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id='albutts-composer-photos'
              type='file'
              multiple
              accept='image/*,video/*'
              className='albutts-composer__file'
              onChange={handlePhotosChange}
              disabled={pending}
            />
            <label
              htmlFor='albutts-composer-photos'
              className='albutts-composer__drop-zone-label'
            >
              <Icon
                id='add_photo_alternate'
                icon={AddPhotoAlternateIcon}
                className='albutts-composer__drop-zone-icon'
              />
              <span className='albutts-composer__drop-zone-text'>
                {dragging
                  ? intl.formatMessage(messages.photosDropCue)
                  : photos.length > 0
                    ? intl.formatMessage(messages.photosPickMore, {
                        count: photos.length,
                      })
                    : intl.formatMessage(messages.photosPick)}
              </span>
            </label>
          </div>
        )}
        {photos.length > 0 && (
          <>
            <ul className='albutts-composer__picks'>
              {photos.map((p) => (
                <li
                  key={p.key}
                  className={`albutts-composer__pick albutts-composer__pick--${p.status}`}
                >
                  <div
                    className='albutts-composer__pick-thumb'
                    title={intl.formatMessage(chipMessage(p.status, messages))}
                  >
                    <img
                      className='albutts-composer__pick-img'
                      src={p.previewUrl}
                      alt={p.caption !== '' ? p.caption : (p.file?.name ?? '')}
                    />
                    <span
                      className={`albutts-composer__chip albutts-composer__chip--${p.status}`}
                      aria-hidden
                    >
                      {chipGlyph(p.status)}
                    </span>
                  </div>
                  <PickCaptionRow
                    photoKey={p.key}
                    caption={p.caption}
                    disabled={
                      pending || p.status === 'done' || p.status === 'adding'
                    }
                    placeholder={intl.formatMessage(
                      messages.captionPlaceholder,
                    )}
                    onChange={handleCaptionChange}
                  />
                </li>
              ))}
            </ul>
            {!createdAlbum && (
              <button
                type='button'
                className='albutts-composer__clear'
                onClick={handleClearPhotos}
                disabled={pending}
              >
                {intl.formatMessage(messages.photosClear)}
              </button>
            )}
          </>
        )}

        {/* Contribution — Album-specific "who can add photos". Reach
            + krews (the universal composer axis) live in the shell
            header via `<ReachDropdown>` (see reachControl above).
            The two-axes ScopePicker retired here 2026-09-09; Album
            is the only composer whose product model actually needs
            the second question. */}
        {forKrew ? (
          <KrewAudienceField
            krew={forKrew}
            value={audience}
            onChange={setAudience}
            disabled={!!createdAlbum}
          />
        ) : (
          <fieldset
            className='albutts-composer__contribution'
            disabled={!!createdAlbum}
          >
            <legend className='albutts-composer__label'>
              {intl.formatMessage(messages.contributionHeading)}
            </legend>
            {isSelfOnly ? (
              <p className='albutts-composer__note'>
                {intl.formatMessage(messages.contributionSelfOnlyNote)}
              </p>
            ) : (
              <>
                <div
                  className='albutts-composer__contribution-chips'
                  role='radiogroup'
                >
                  <button
                    type='button'
                    role='radio'
                    aria-checked={contributionOpen}
                    className={`albutts-composer__contribution-chip${contributionOpen ? ' albutts-composer__contribution-chip--selected' : ''}`}
                    onClick={handleContributionOpen}
                  >
                    {intl.formatMessage(messages.contributionOpen)}
                  </button>
                  <button
                    type='button'
                    role='radio'
                    aria-checked={!contributionOpen}
                    className={`albutts-composer__contribution-chip${!contributionOpen ? ' albutts-composer__contribution-chip--selected' : ''}`}
                    onClick={handleContributionRestricted}
                  >
                    {intl.formatMessage(messages.contributionRestricted)}
                  </button>
                </div>
                {!contributionOpen && (
                  <>
                    <div className='albutts-composer__contribution-row'>
                      <div className='albutts-composer__label'>
                        {intl.formatMessage(messages.contributorKrews)}
                      </div>
                      <KrewMultiSelect
                        options={availableKrews}
                        selectedIds={contributorKrewIds}
                        onToggle={handleToggleContributorKrew}
                        disabled={!!createdAlbum}
                        emptyLabel={intl.formatMessage(messages.krewsEmpty)}
                      />
                    </div>
                    <div className='albutts-composer__contribution-row'>
                      <div className='albutts-composer__label'>
                        {intl.formatMessage(messages.contributorPeople)}
                      </div>
                      <AccountMultiSelect
                        value={contributorAccounts}
                        onChange={handleContributorAccountsChange}
                        disabled={!!createdAlbum}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </fieldset>
        )}

        {createdAlbum && photos.length > 0 && (
          <p className='albutts-composer__progress' aria-live='polite'>
            {intl.formatMessage(messages.progressLine, {
              done: doneCount,
              total: photos.length,
              failed: failedCount,
            })}
            {inflightCount > 0 && ' · uploading'}
          </p>
        )}

        {!createdAlbum && uploadFailedCount > 0 && (
          <>
            <p className='albutts-composer__error' role='alert'>
              {intl.formatMessage(messages.uploadFailed, {
                failed: uploadFailedCount,
              })}
            </p>
            <div className='albutts-composer__inline-actions'>
              <button
                type='button'
                className='albutts-btn albutts-btn--ghost'
                onClick={handleRetryFailed}
              >
                {intl.formatMessage(messages.retryUploads, {
                  count: uploadFailedCount,
                })}
              </button>
            </div>
          </>
        )}

        {rateLimitedUntil !== null && (
          <p className='albutts-composer__progress' aria-live='polite'>
            {intl.formatMessage(messages.rateLimited, {
              time: intl.formatTime(rateLimitedUntil, {
                hour: 'numeric',
                minute: '2-digit',
              }),
            })}
          </p>
        )}

        {error && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}
        {createdAlbum && failedCount > 0 && !pending && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.photoErrorPartial, {
              failed: failedCount,
            })}
          </p>
        )}

        {saveError && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(
              saveError === 'save'
                ? messages.saveError
                : saveError === 'give'
                  ? messages.giveError
                  : messages.deleteError,
            )}
          </p>
        )}

        {editing &&
          !forKrew &&
          editing.is_owner &&
          availableKrews.length > 0 && (
            <GiveToKrew
              krews={availableKrews}
              disabled={giving || pending || deleting}
              onGive={handleGive}
            />
          )}

        {editing && forKrew && !editing.can_delete && (
          <p className='albutts-composer__note'>
            {intl.formatMessage(messages.krewNoDelete)}
          </p>
        )}

        {editing && (editing.can_delete ?? editing.is_owner) && (
          <div className='albutts-composer__danger'>
            <button
              type='button'
              className='albutts-composer__delete'
              onClick={handleDelete}
              disabled={deleting || pending}
            >
              {intl.formatMessage(messages.deleteAlbum)}
            </button>
          </div>
        )}

        {createdAlbum && failedCount > 0 && !pending && (
          <div className='albutts-composer__inline-actions'>
            <button
              type='button'
              className='albutts-btn albutts-btn--ghost'
              onClick={handleRetryFailed}
            >
              {intl.formatMessage(messages.retryFailed, {
                count: failedCount,
              })}
            </button>
          </div>
        )}
      </div>
    </ComposeShell>
  );
};

// Small memoized row so `CaptionTextarea`'s per-photo `onChange` can
// bind the photo's `key` once instead of an inline arrow on every
// render (react/jsx-no-bind).
interface PickCaptionRowProps {
  photoKey: string;
  caption: string;
  disabled: boolean;
  placeholder: string;
  onChange: (key: string, value: string) => void;
}

const PickCaptionRow = memo(function PickCaptionRow({
  photoKey,
  caption,
  disabled,
  placeholder,
  onChange,
}: PickCaptionRowProps) {
  const handle = useCallback(
    (value: string) => {
      onChange(photoKey, value);
    },
    [onChange, photoKey],
  );
  return (
    <CaptionTextarea
      className='albutts-composer__pick-caption'
      value={caption}
      onChange={handle}
      placeholder={placeholder}
      maxLength={CAPTION_MAX}
      rows={2}
      disabled={disabled}
    />
  );
});

// One saved draft in the composer's Drafts row; tap to carry on with it.
const DraftChip = memo(function DraftChip({
  draft,
  active,
  disabled,
  label,
  onPick,
}: {
  draft: ApiAlbumDraftJSON;
  active: boolean;
  disabled: boolean;
  label: string;
  onPick: (draft: ApiAlbumDraftJSON) => void;
}) {
  const handleClick = useCallback(() => {
    if (!active) onPick(draft);
  }, [active, draft, onPick]);
  return (
    <li>
      <button
        type='button'
        className={`albutts-composer__draft-chip${active ? ' albutts-composer__draft-chip--active' : ''}`}
        aria-pressed={active}
        disabled={disabled}
        onClick={handleClick}
      >
        {label}
      </button>
    </li>
  );
});

// The edit form's cover row: the album's photos as a wrapping grid (no
// side-scroll on a phone), tap one to make it the cover. Videos and
// photos without a still are skipped.
interface CoverPickerProps {
  photos: ApiAlbumJSON['photos'];
  coverId: string | undefined;
  onPick: (mediaId: string) => void;
  label: string;
  hint: string;
}

const CoverPicker: React.FC<CoverPickerProps> = ({
  photos,
  coverId,
  onPick,
  label,
  hint,
}) => (
  <fieldset className='albutts-composer__cover'>
    <legend className='albutts-composer__label'>{label}</legend>
    <p className='albutts-composer__note'>{hint}</p>
    <ul className='albutts-composer__cover-grid'>
      {photos.map((p) => {
        const media = p.status.media_attachments[0];
        if (!media || media.type !== 'image' || !p.url) return null;
        return (
          <CoverOption
            key={p.id}
            mediaId={media.id}
            url={media.preview_url}
            alt={p.caption ?? ''}
            selected={media.id === coverId}
            onPick={onPick}
          />
        );
      })}
    </ul>
  </fieldset>
);

const CoverOption = memo(function CoverOption({
  mediaId,
  url,
  alt,
  selected,
  onPick,
}: {
  mediaId: string;
  url: string;
  alt: string;
  selected: boolean;
  onPick: (mediaId: string) => void;
}) {
  const handleClick = useCallback(() => {
    onPick(mediaId);
  }, [onPick, mediaId]);
  return (
    <li>
      <button
        type='button'
        className={`albutts-composer__cover-option${selected ? ' albutts-composer__cover-option--selected' : ''}`}
        aria-pressed={selected}
        onClick={handleClick}
      >
        <img src={url} alt={alt} loading='lazy' />
      </button>
    </li>
  );
});

function chipGlyph(status: PhotoStatus): string {
  switch (status) {
    case 'done':
    case 'uploaded':
      return '✓';
    case 'failed':
      return '!';
    case 'uploading':
    case 'adding':
      return '…';
    default:
      return '';
  }
}

function chipMessage(
  status: PhotoStatus,
  m: typeof messages,
): (typeof messages)[keyof typeof messages] {
  switch (status) {
    case 'done':
      return m.chipDone;
    case 'failed':
      return m.chipFailed;
    case 'uploading':
      return m.chipUploading;
    case 'uploaded':
      return m.chipUploaded;
    case 'adding':
      return m.chipAdding;
    default:
      return m.chipQueued;
  }
}

// Who sees a Krew album: the Krew, or everyone on Kronk if the Krew is listed
// in Discover (docs/spaces/albutts.md, Krew albums).
const KrewAudienceField: React.FC<{
  krew: ComposerKrew;
  value: KrewAlbumAudience;
  onChange: (value: KrewAlbumAudience) => void;
  disabled: boolean;
}> = ({ krew, value, onChange, disabled }) => {
  const intl = useIntl();
  const chooseKrew = useCallback(() => {
    onChange('krew');
  }, [onChange]);
  const chooseEveryone = useCallback(() => {
    onChange('everyone');
  }, [onChange]);
  const canEveryone = krew.listed || value === 'everyone';

  return (
    <fieldset className='albutts-composer__contribution' disabled={disabled}>
      <legend className='albutts-composer__label'>
        {intl.formatMessage(messages.krewAudience)}
      </legend>
      <div className='albutts-composer__contribution-chips' role='radiogroup'>
        <button
          type='button'
          role='radio'
          aria-checked={value === 'krew'}
          className={`albutts-composer__contribution-chip${value === 'krew' ? ' albutts-composer__contribution-chip--selected' : ''}`}
          onClick={chooseKrew}
        >
          {intl.formatMessage(messages.krewAudienceKrew, { krew: krew.name })}
        </button>
        {canEveryone && (
          <button
            type='button'
            role='radio'
            aria-checked={value === 'everyone'}
            className={`albutts-composer__contribution-chip${value === 'everyone' ? ' albutts-composer__contribution-chip--selected' : ''}`}
            onClick={chooseEveryone}
          >
            {intl.formatMessage(messages.krewAudienceEveryone)}
          </button>
        )}
      </div>
      {!canEveryone && (
        <p className='albutts-composer__note'>
          {intl.formatMessage(messages.krewAudienceHidden, { krew: krew.name })}
        </p>
      )}
      <p className='albutts-composer__note'>
        {intl.formatMessage(messages.krewAdds, { krew: krew.name })}
      </p>
    </fieldset>
  );
};

// Give a personal album to one of your Krews, from its edit form.
const GiveToKrew: React.FC<{
  krews: KrewOption[];
  disabled: boolean;
  onGive: (krewId: string, krewName: string) => void;
}> = ({ krews, disabled, onGive }) => {
  const intl = useIntl();
  const [krewId, setKrewId] = useState(krews[0]?.id ?? '');
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setKrewId(e.target.value);
    },
    [],
  );
  const handleGive = useCallback(() => {
    const krew = krews.find((k) => k.id === krewId);
    if (krew) onGive(krew.id, krew.name);
  }, [krews, krewId, onGive]);

  return (
    <div className='albutts-composer__contribution'>
      <div className='albutts-composer__label'>
        {intl.formatMessage(messages.give)}
      </div>
      <p className='albutts-composer__note'>
        {intl.formatMessage(messages.giveHint)}
      </p>
      <div className='albutts-composer__inline-actions'>
        <select
          value={krewId}
          onChange={handleChange}
          disabled={disabled}
          aria-label={intl.formatMessage(messages.give)}
        >
          {krews.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <button
          type='button'
          className='albutts-btn albutts-btn--ghost'
          onClick={handleGive}
          disabled={disabled || !krewId}
        >
          {intl.formatMessage(messages.give)}
        </button>
      </div>
    </div>
  );
};
