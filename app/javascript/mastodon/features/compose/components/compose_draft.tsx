import { useCallback, useEffect, useRef, useState } from 'react';

import type { List as ImmutableList, Map as ImmutableMap } from 'immutable';

import {
  COMPOSE_SET_DRAFT,
  changeComposeKrewTargets,
  resetCompose,
} from 'mastodon/actions/compose';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { DraftBar } from 'mastodon/components/draft_bar';
import { useDraft } from 'mastodon/hooks/useDraft';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// Drafts for the post composer (docs/design.md, Drafts): korner feed, kind
// post, on the same `useDraft` as every other composer. The text, content
// warning, reach, language, poll and finished uploads are saved as you go,
// silently, on this device and on the server. Only when a draft was picked
// up does the drafts line show, under the box.
//
// Only a plain new post: never a reply or an edit, which carry their own
// context. Whether it is one is taken when the composer opens, so cancelling
// a reply later doesn't pull a draft over what you're writing. A draft only
// fills an empty box: a composer opened with a mention keeps it.
//
// Opened to post to a Krew ("Post to <Krew>"), the drafts are that Krew's
// (context `krew:<id>`), so a feed draft never lands on a Krew post or
// changes its reach, and each Krew keeps its own.
//
// The post composer isn't in <ComposeShell>, so it draws <DraftBar> itself.

interface PostDraftParams {
  text?: string;
  spoiler_text?: string;
  visibility?: string;
  language?: string | null;
  sensitive?: boolean;
  poll?: {
    options: string[];
    expires_in: number;
    multiple: boolean;
    hide_totals: boolean;
  } | null;
}

type ComposeState = ImmutableMap<string, unknown>;

const pollParams = (poll: ImmutableMap<string, unknown> | null) => {
  if (!poll) return null;
  const options = (poll.get('options') as ImmutableList<string>)
    .toArray()
    .filter((o) => o.length > 0);
  return {
    options,
    expires_in: poll.get('expires_in') as number,
    multiple: !!poll.get('multiple'),
    hide_totals: !!poll.get('hide_totals'),
  };
};

export const ComposeDraft: React.FC = () => {
  const dispatch = useAppDispatch();
  const compose = useAppSelector((state) => state.compose as ComposeState);

  const text = (compose.get('text') ?? '') as string;
  const spoiler = !!compose.get('spoiler');
  const spoilerText = (compose.get('spoiler_text') ?? '') as string;
  const privacy = compose.get('privacy') as string | null;
  const language = (compose.get('language') ?? null) as string | null;
  const sensitive = !!compose.get('sensitive');
  const poll = compose.get('poll') as ImmutableMap<string, unknown> | null;
  const media = compose.get('media_attachments') as ImmutableList<
    ImmutableMap<string, unknown>
  >;
  const submitting = !!compose.get('is_submitting');
  const uploading = !!compose.get('is_uploading');

  // A plain new post, as the composer opened, and the one Krew it was
  // opened for, if any.
  const [plainPost] = useState(
    () => compose.get('id') === null && compose.get('in_reply_to') === null,
  );
  const [krewId] = useState(() => {
    const krews = compose.get('krew_ids') as ImmutableList<string> | null;
    return krews?.size === 1 ? (krews.first() ?? null) : null;
  });

  const textRef = useRef(text);
  textRef.current = text;

  const apply = useCallback(
    (d: ApiComposerDraftJSON<PostDraftParams> | null) => {
      if (!d) {
        dispatch(resetCompose());
        // Blanked, it is still a post to the Krew it was opened for.
        if (krewId) dispatch(changeComposeKrewTargets([krewId]));
        return;
      }
      dispatch({ type: COMPOSE_SET_DRAFT, draft: d });
    },
    [dispatch, krewId],
  );
  const resume = useCallback(() => textRef.current.trim() === '', []);

  const mediaIds = media.toArray().map((m) => m.get('id') as string);
  const hasContent = text.trim() !== '' || mediaIds.length > 0 || poll !== null;

  const draft = useDraft<PostDraftParams>({
    korner: 'feed',
    kind: 'post',
    context: krewId ? `krew:${krewId}` : null,
    active: plainPost,
    snapshot: {
      params: {
        text,
        spoiler_text: spoiler ? spoilerText : '',
        visibility: privacy ?? undefined,
        language,
        sensitive,
        poll: pollParams(poll),
      },
      mediaIds,
    },
    hasContent,
    apply,
    resume,
    describe: (d) => d.params.text?.split('\n')[0]?.slice(0, 40),
    paused: submitting,
    locked: uploading,
  });

  // Posted: the composer empties when the post goes through, and then the
  // draft is done with. A failed post keeps its text, and its draft.
  const finishDraft = draft.finish;
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !submitting && !hasContent) finishDraft();
    wasSubmitting.current = submitting;
  }, [submitting, hasContent, finishDraft]);

  return <DraftBar draft={draft} disabled={submitting || uploading} />;
};
