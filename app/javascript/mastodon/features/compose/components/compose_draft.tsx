import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { List as ImmutableList } from 'immutable';

import {
  changeCompose,
  restoreComposeMedia,
  undoUploadCompose,
} from 'mastodon/actions/compose';
import { DraftRestoredPill } from 'mastodon/components/draft_restored_pill';
import { useComposerDraft } from 'mastodon/hooks/useComposerDraft';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// Draft auto-save for the main post composer (docs/rebuild/decisions.md
// 2026-08-10). The compose store already survives in-app navigation; this adds
// survival across a full refresh / tab-close by persisting the post text AND
// its already-uploaded media (by their server ids + previews) to localStorage.
// Scoped to the plain top-level composer — never a reply or an edit, which
// carry their own context — and it never overwrites content already present.
// Renders the "Draft restored · Discard" pill when it repopulated an empty
// composer on mount.
export const ComposeDraft: React.FC = () => {
  const dispatch = useAppDispatch();
  const text = useAppSelector(
    (state) => (state.compose.get('text') ?? '') as string,
  );
  const mediaList = useAppSelector(
    (state) => state.compose.get('media_attachments') as ImmutableList<unknown>,
  );
  const isEditing = useAppSelector((state) => state.compose.get('id') !== null);
  const isInReply = useAppSelector(
    (state) => state.compose.get('in_reply_to') !== null,
  );

  // Plain-JS media, for the serialisable snapshot + discard iteration.
  const media = useMemo(() => mediaList.toJS(), [mediaList]);

  // Live text, so the mount-time restore can check it without re-subscribing.
  const textRef = useRef(text);
  textRef.current = text;
  const [pillShown, setPillShown] = useState(false);

  const snapshot = useMemo(() => ({ text, media }), [text, media]);
  const handleRestore = useCallback(
    (d: { text: string; media: unknown[] }) => {
      // Never clobber content already present (e.g. an in-SPA remount).
      if (textRef.current.trim() !== '') return;
      dispatch(changeCompose(d.text));
      if (d.media.length > 0) dispatch(restoreComposeMedia(d.media));
      setPillShown(true);
    },
    [dispatch],
  );

  const draft = useComposerDraft('compose:main', snapshot, handleRestore, {
    active: !isEditing && !isInReply,
    enabled:
      (text.trim() !== '' || media.length > 0) && !isEditing && !isInReply,
  });
  const discardDraft = draft.discard;

  const handleDiscard = useCallback(() => {
    dispatch(changeCompose(''));
    media.forEach((m) => {
      const id = (m as { id?: unknown }).id;
      if (typeof id === 'string') dispatch(undoUploadCompose(id));
    });
    setPillShown(false);
    discardDraft();
  }, [dispatch, discardDraft, media]);

  // Drop the pill once the composer is empty again (posted / cleared).
  useEffect(() => {
    if (text === '' && media.length === 0 && pillShown) setPillShown(false);
  }, [text, media, pillShown]);

  if (!pillShown) return null;
  return <DraftRestoredPill onDiscard={handleDiscard} />;
};
