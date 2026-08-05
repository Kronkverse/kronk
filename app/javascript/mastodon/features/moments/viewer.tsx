// Moments deep-link viewer — full-screen page at /hub/moments/:id
// per docs/spaces/moments.md § Where you see Moments. Fetches the
// requested Moment plus the owner's full active stack, and lets the
// viewer cycle through with keyboard/tap. Froth toggles the
// ephemeral favourite; Reply opens a Nudges thread with the poster
// (the quoted-moment attachment on the Nudges side is a follow-up —
// v1 just routes to /nudges/<owner_id> and the poster can start a
// thread from there).

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MessageDescriptor } from 'react-intl';
import {
  FormattedMessage,
  FormattedRelativeTime,
  defineMessages,
  useIntl,
} from 'react-intl';

import { useHistory, useParams } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ReplyIcon from '@/material-icons/400-24px/chat_bubble.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import FrothIcon from '@/material-icons/400-24px/star-fill.svg?react';
import FrothOutlineIcon from '@/material-icons/400-24px/star.svg?react';
import {
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';
import { KornerKrewPicker } from 'mastodon/components/korner_krew_picker';
import { KornerVisibilityPicker } from 'mastodon/components/korner_visibility_picker';
import { KronkStarfield } from 'mastodon/components/kronk_starfield';
import { VoicePlayer } from 'mastodon/components/media';
import { me } from 'mastodon/initial_state';

import { MomentsComposer } from './composer';

const audienceLabels = defineMessages({
  public: { id: 'moments.audience.public', defaultMessage: 'Anyone' },
  orbit: { id: 'moments.audience.orbit', defaultMessage: 'Orbit' },
  mates: { id: 'moments.audience.mates', defaultMessage: 'Mates' },
  self_only: { id: 'moments.audience.self_only', defaultMessage: 'Only me' },
  krew: { id: 'moments.audience.krew', defaultMessage: 'Krew' },
});

const audienceLabel = (visibility: string): MessageDescriptor => {
  switch (visibility) {
    case 'public':
      return audienceLabels.public;
    case 'orbit':
      return audienceLabels.orbit;
    case 'self_only':
      return audienceLabels.self_only;
    case 'krew':
      return audienceLabels.krew;
    default:
      return audienceLabels.mates;
  }
};

interface AccountJSON {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
  avatar_static: string;
}

interface MediaJSON {
  id: string;
  preview_url: string;
  url: string;
  type: string;
}

interface MomentJSON {
  id: string;
  caption: string | null;
  visibility: string;
  expires_at: string;
  created_at: string;
  active: boolean;
  froth_count: number;
  frothed_by_viewer: boolean;
  account: AccountJSON;
  krew: { id: string; name: string } | null;
  media_attachment: MediaJSON;
  // Populated only for photo+voice Moments (spec § What a Moment is
  // — voice does not pair with video). The viewer renders a
  // <VoicePlayer> over the still; audio autoplay is unlocked by the
  // tap-to-open gesture, so no explicit play button is needed on
  // opening (the player is still visible + interactive).
  voice_url: string | null;
}

const ELAPSED_UPDATE_MS = 30_000; // refresh the progress bar every 30s

const MomentViewer = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const intl = useIntl();

  const [stack, setStack] = useState<MomentJSON[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [frothPending, setFrothPending] = useState(false);
  const [visibilityPending, setVisibilityPending] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  // Bumped after a successful post from the in-viewer composer so the
  // stack-load effect re-runs and picks up the new Moment. The clicked
  // Moment stays the initial cursor position (indexes shift only if the
  // user is on their own stack, which the effect handles by re-seeking).
  const [reloadTick, setReloadTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch the requested Moment first, then load the owner's whole
  // active stack in one call (scope=account so we get all of them
  // regardless of visibility gating on this viewer). The clicked
  // Moment becomes the initial cursor position in that stack.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiRequestGet<MomentJSON>(`v1/moments/${id}`)
      .then((moment) => {
        if (cancelled) return moment;
        return apiRequestGet<MomentJSON[]>('v1/moments', {
          account_id: moment.account.id,
        }).then((ownerStack) => {
          if (cancelled) return null;
          const sorted = [...ownerStack].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          );
          const startIdx = sorted.findIndex((m) => m.id === id);
          setStack(sorted);
          setIndex(startIdx >= 0 ? startIdx : 0);
          setLoading(false);
          return null;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setError('load-failed');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadTick]);

  // Keep the progress bar honest even if the tab stays open for a
  // while (the Moment marches toward its 24h expiry regardless of
  // whether the viewer is interacting).
  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(Date.now());
    }, ELAPSED_UPDATE_MS);
    return () => {
      window.clearInterval(tick);
    };
  }, []);

  const moment = stack[index];

  const close = useCallback(() => {
    // Prefer history.goBack() so the viewer feels modal; fall back to
    // the grid when there's no history (deep-link open in a new tab).
    if (window.history.length > 1) {
      history.goBack();
    } else {
      history.push('/hub/moments');
    }
  }, [history]);

  const prev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);
  const next = useCallback(() => {
    setIndex((i) => (i < stack.length - 1 ? i + 1 : i));
  }, [stack.length]);

  // Keyboard: Left/Right cycle within the owner's stack; Escape closes.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') prev();
      else if (event.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [close, prev, next]);

  // Deep-link URL keeps the current cursor in sync (so a browser
  // back / share captures the Moment actually being viewed).
  useEffect(() => {
    if (!moment) return;
    if (moment.id === id) return;
    history.replace(`/hub/moments/${moment.id}`);
  }, [moment, id, history]);

  const toggleFrothAsync = useCallback(async () => {
    if (!moment || frothPending) return;
    setFrothPending(true);
    const willBeFrothed = !moment.frothed_by_viewer;
    // Optimistic
    setStack((prev) => {
      const next = [...prev];
      const found = next[index];
      if (found) {
        next[index] = {
          ...found,
          frothed_by_viewer: willBeFrothed,
          froth_count: found.froth_count + (willBeFrothed ? 1 : -1),
        };
      }
      return next;
    });
    try {
      if (willBeFrothed) {
        await apiRequestPost(`v1/moments/${moment.id}/froth`, {});
      } else {
        await apiRequestDelete(`v1/moments/${moment.id}/froth`);
      }
    } catch {
      // Rollback on failure
      setStack((prev) => {
        const next = [...prev];
        const found = next[index];
        if (found) {
          next[index] = {
            ...found,
            frothed_by_viewer: !willBeFrothed,
            froth_count: found.froth_count + (willBeFrothed ? -1 : 1),
          };
        }
        return next;
      });
    } finally {
      setFrothPending(false);
    }
  }, [moment, frothPending, index]);

  // Wrap the async handler so it returns void — ESLint's
  // no-misused-promises otherwise flags the raw async on the button.
  const toggleFroth = useCallback(() => {
    void toggleFrothAsync();
  }, [toggleFrothAsync]);

  // Re-scope one's own Moment after the fact (Stage 3). Optimistic; the
  // stack entry's visibility updates immediately, rolls back on error.
  const changeVisibilityAsync = useCallback(
    async (next: string, krewId: string | null) => {
      if (!moment || visibilityPending) return;
      setVisibilityPending(true);
      const previous = moment.visibility;
      setStack((prev) => {
        const copy = [...prev];
        const found = copy[index];
        if (found) copy[index] = { ...found, visibility: next };
        return copy;
      });
      try {
        await apiRequestPut(`v1/moments/${moment.id}`, {
          visibility: next,
          krew_id: krewId,
        });
      } catch {
        setStack((prev) => {
          const copy = [...prev];
          const found = copy[index];
          if (found) copy[index] = { ...found, visibility: previous };
          return copy;
        });
      } finally {
        setVisibilityPending(false);
      }
    },
    [moment, visibilityPending, index],
  );

  const changeVisibility = useCallback(
    (next: string, krewId: string | null) => {
      void changeVisibilityAsync(next, krewId);
    },
    [changeVisibilityAsync],
  );

  const reply = useCallback(() => {
    if (!moment) return;
    // v1: send the viewer to a Nudges thread with the poster. The
    // full "Moment quoted as opener" attachment is a follow-up that
    // needs Nudges-side wiring per docs/spaces/moments.md § Cross-
    // korner connections (moments.reply_started event).
    history.push(`/nudges/${moment.account.id}`);
  }, [moment, history]);

  const openComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
  }, []);
  const onPosted = useCallback(() => {
    setComposerOpen(false);
    setReloadTick((n) => n + 1);
  }, []);

  const onCloseClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      close();
    },
    [close],
  );
  const onBackdropClick = useCallback(() => {
    close();
  }, [close]);
  const onBackdropKey = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') close();
    },
    [close],
  );

  // Tap zones — split the viewport into left-third (prev) / centre /
  // right-third (next). Video middle-tap toggles play/pause; photo
  // middle-tap is a no-op.
  const onLeftTap = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      prev();
    },
    [prev],
  );
  const onRightTap = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      next();
    },
    [next],
  );
  const onCentreTap = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  if (loading) {
    return (
      <div className='moments-viewer moments-viewer--loading'>
        <FormattedMessage
          id='moments.viewer.loading'
          defaultMessage='Loading Moment…'
        />
      </div>
    );
  }

  if (error || !moment) {
    return (
      <div className='moments-viewer moments-viewer--error'>
        <div className='moments-viewer__error-body'>
          <FormattedMessage
            id='moments.viewer.gone'
            defaultMessage='This Moment is gone.'
          />
          <button
            type='button'
            className='moments-viewer__error-close'
            onClick={close}
          >
            <FormattedMessage
              id='moments.viewer.back'
              defaultMessage='Back to Moments'
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ViewerBody
        moment={moment}
        stack={stack}
        index={index}
        now={now}
        frothPending={frothPending}
        videoRef={videoRef}
        onBackdropClick={onBackdropClick}
        onBackdropKey={onBackdropKey}
        onCloseClick={onCloseClick}
        onLeftTap={onLeftTap}
        onCentreTap={onCentreTap}
        onRightTap={onRightTap}
        onFroth={toggleFroth}
        onReply={reply}
        isOwner={moment.account.id === me}
        onChangeVisibility={changeVisibility}
        visibilityPending={visibilityPending}
        onAddAnother={openComposer}
        intl={intl}
      />
      {composerOpen && (
        <MomentsComposer onClose={closeComposer} onPosted={onPosted} />
      )}
    </>
  );
};

interface ViewerBodyProps {
  moment: MomentJSON;
  stack: MomentJSON[];
  index: number;
  now: number;
  frothPending: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onBackdropClick: () => void;
  onBackdropKey: (e: ReactKeyboardEvent) => void;
  onCloseClick: (e: MouseEvent) => void;
  onLeftTap: (e: MouseEvent) => void;
  onCentreTap: (e: MouseEvent) => void;
  onRightTap: (e: MouseEvent) => void;
  onFroth: () => void;
  onReply: () => void;
  isOwner: boolean;
  onChangeVisibility: (next: string, krewId: string | null) => void;
  visibilityPending: boolean;
  onAddAnother: () => void;
  intl: ReturnType<typeof useIntl>;
}

const ViewerBody = ({
  moment,
  stack,
  index,
  now,
  frothPending,
  videoRef,
  onBackdropClick,
  onBackdropKey,
  onCloseClick,
  onLeftTap,
  onCentreTap,
  onRightTap,
  onFroth,
  onReply,
  isOwner,
  onChangeVisibility,
  visibilityPending,
  onAddAnother,
  intl,
}: ViewerBodyProps) => {
  const isVideo = moment.media_attachment.type === 'video';
  const [editingVisibility, setEditingVisibility] = useState(false);
  const [choosingKrew, setChoosingKrew] = useState(false);

  const toggleEditingVisibility = useCallback(() => {
    setEditingVisibility((v) => !v);
    // Opening a krew Moment goes straight to the krew list (to change it);
    // any other scope shows just the scope picker until krew is chosen.
    setChoosingKrew(moment.visibility === 'krew');
  }, [moment.visibility]);

  // Non-krew scopes commit immediately; picking `krew` reveals the krew
  // sub-picker and waits for a krew before committing.
  const pickScope = useCallback(
    (next: string) => {
      if (next === 'krew') {
        setChoosingKrew(true);
      } else {
        onChangeVisibility(next, null);
        setEditingVisibility(false);
        setChoosingKrew(false);
      }
    },
    [onChangeVisibility],
  );

  const pickKrew = useCallback(
    (krewId: string) => {
      onChangeVisibility('krew', krewId);
      setEditingVisibility(false);
      setChoosingKrew(false);
    },
    [onChangeVisibility],
  );

  // Progress: 0 at post time → 1 at expiry (24h). Clamped.
  const progress = useMemo(() => {
    const created = new Date(moment.created_at).getTime();
    const expires = new Date(moment.expires_at).getTime();
    const total = Math.max(1, expires - created);
    const elapsed = Math.max(0, now - created);
    return Math.min(1, elapsed / total);
  }, [moment.created_at, moment.expires_at, now]);

  const secondsUntilExpiry = Math.round(
    (new Date(moment.expires_at).getTime() - now) / 1000,
  );

  return (
    <div
      className='moments-viewer'
      role='dialog'
      aria-label={`Moment by ${moment.account.acct}`}
    >
      {/* Backdrop is transparent — the starfield sits behind it and
          shows through. Click anywhere off the stage closes the viewer,
          same as before; the starfield canvas is pointer-events:none so
          taps fall through to this button. */}
      <div className='moments-viewer__cosmos' aria-hidden>
        <KronkStarfield />
      </div>
      <button
        type='button'
        className='moments-viewer__backdrop'
        onClick={onBackdropClick}
        onKeyDown={onBackdropKey}
        aria-label='Close viewer'
      />

      <div className='moments-viewer__stage'>
        {/* Progress bar — one segment per Moment in the owner's stack;
            the segment for the current Moment fills as time elapses. */}
        <div
          className='moments-viewer__progress'
          role='progressbar'
          aria-valuenow={Math.round(progress * 100)}
        >
          {stack.map((m, i) => (
            <span
              key={m.id}
              className={`moments-viewer__progress-seg${
                i < index ? ' moments-viewer__progress-seg--done' : ''
              }${i === index ? ' moments-viewer__progress-seg--active' : ''}`}
            >
              {i === index && (
                <span
                  className='moments-viewer__progress-fill'
                  style={{ width: `${(progress * 100).toString()}%` }}
                />
              )}
            </span>
          ))}
        </div>

        <header className='moments-viewer__header'>
          <img
            className='moments-viewer__avatar'
            src={moment.account.avatar || moment.account.avatar_static}
            alt=''
            aria-hidden
          />
          <div className='moments-viewer__identity'>
            <span className='moments-viewer__display-name'>
              {moment.account.display_name || `@${moment.account.acct}`}
            </span>
            <span className='moments-viewer__ago'>
              <FormattedRelativeTime
                value={-(now - new Date(moment.created_at).getTime()) / 1000}
                numeric='auto'
                updateIntervalInSeconds={60}
              />
              {secondsUntilExpiry > 0 && (
                <>
                  {' · '}
                  <FormattedMessage
                    id='moments.viewer.gone_in'
                    defaultMessage='gone {when}'
                    values={{
                      when: (
                        <FormattedRelativeTime
                          value={secondsUntilExpiry}
                          numeric='auto'
                          updateIntervalInSeconds={60}
                        />
                      ),
                    }}
                  />
                </>
              )}
            </span>
            {isOwner && (
              <button
                type='button'
                className='moments-viewer__visibility'
                onClick={toggleEditingVisibility}
                disabled={visibilityPending}
                aria-expanded={editingVisibility}
              >
                {intl.formatMessage(audienceLabel(moment.visibility))}
                <span aria-hidden> ▾</span>
              </button>
            )}
          </div>
          <button
            type='button'
            className='moments-viewer__close'
            onClick={onCloseClick}
            aria-label='Close'
          >
            <CloseIcon />
          </button>
        </header>

        {isOwner && editingVisibility && (
          <div className='moments-viewer__visibility-panel'>
            <span className='moments-viewer__visibility-panel-label'>
              <FormattedMessage
                id='moments.viewer.who_sees'
                defaultMessage='Who can see this'
              />
            </span>
            <KornerVisibilityPicker
              slug='moments'
              value={moment.visibility}
              onChange={pickScope}
              disabled={visibilityPending}
            />
            {choosingKrew && (
              <KornerKrewPicker
                value={moment.krew?.id ?? null}
                onChange={pickKrew}
                disabled={visibilityPending}
              />
            )}
          </div>
        )}

        <div className='moments-viewer__media-wrap'>
          {isVideo ? (
            <video
              ref={videoRef}
              className='moments-viewer__video'
              src={
                moment.media_attachment.url ||
                moment.media_attachment.preview_url
              }
              autoPlay
              muted
              playsInline
              loop
            />
          ) : (
            <img
              className='moments-viewer__image'
              src={
                moment.media_attachment.url ||
                moment.media_attachment.preview_url
              }
              alt={moment.caption ?? ''}
            />
          )}

          {/* Tap zones layered over the media. Split thirds: left =
              prev, centre = pause/play (video), right = next. */}
          <button
            type='button'
            className='moments-viewer__tap moments-viewer__tap--left'
            onClick={onLeftTap}
            aria-label='Previous Moment'
          />
          <button
            type='button'
            className='moments-viewer__tap moments-viewer__tap--centre'
            onClick={onCentreTap}
            aria-label={isVideo ? 'Play or pause' : 'Moment'}
          />
          <button
            type='button'
            className='moments-viewer__tap moments-viewer__tap--right'
            onClick={onRightTap}
            aria-label='Next Moment'
          />
        </div>

        {moment.voice_url && !isVideo && (
          <div className='moments-viewer__voice'>
            <VoicePlayer src={moment.voice_url} />
          </div>
        )}

        {moment.caption && (
          <div className='moments-viewer__caption'>{moment.caption}</div>
        )}

        <footer className='moments-viewer__actions'>
          {isOwner && (
            <button
              type='button'
              className='moments-viewer__action moments-viewer__action--add'
              onClick={onAddAnother}
              aria-label={intl.formatMessage({
                id: 'moments.viewer.add_another',
                defaultMessage: 'Post another Moment',
              })}
            >
              <AddIcon />
              <span className='moments-viewer__action-label'>
                <FormattedMessage
                  id='moments.viewer.add_another_label'
                  defaultMessage='Add'
                />
              </span>
            </button>
          )}
          <button
            type='button'
            className={`moments-viewer__action moments-viewer__action--froth${
              moment.frothed_by_viewer ? ' moments-viewer__action--frothed' : ''
            }`}
            onClick={onFroth}
            disabled={frothPending}
            aria-pressed={moment.frothed_by_viewer}
            aria-label={intl.formatMessage(
              moment.frothed_by_viewer
                ? {
                    id: 'moments.viewer.unfroth',
                    defaultMessage: 'Un-froth',
                  }
                : { id: 'moments.viewer.froth', defaultMessage: 'Froth' },
            )}
          >
            {moment.frothed_by_viewer ? <FrothIcon /> : <FrothOutlineIcon />}
            <span className='moments-viewer__action-count'>
              {moment.froth_count}
            </span>
          </button>
          {!isOwner && (
            <button
              type='button'
              className='moments-viewer__action moments-viewer__action--reply'
              onClick={onReply}
              aria-label={intl.formatMessage({
                id: 'moments.viewer.reply',
                defaultMessage: 'Reply via Nudge',
              })}
            >
              <ReplyIcon />
              <span className='moments-viewer__action-label'>
                <FormattedMessage
                  id='moments.viewer.reply_label'
                  defaultMessage='Reply'
                />
              </span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export const Moment = MomentViewer;

// eslint-disable-next-line import/no-default-export -- async-components expects a default
export default MomentViewer;
