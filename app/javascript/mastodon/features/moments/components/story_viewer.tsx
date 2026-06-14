import { useCallback, useEffect, useRef, useState } from 'react';

import SendIcon from '@/material-icons/400-24px/arrow_upward-fill.svg?react';
import FavoriteIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import FavoriteBorderIcon from '@/material-icons/400-24px/favorite.svg?react';
import PrevIcon from '@/material-icons/400-24px/navigate_before-fill.svg?react';
import NextIcon from '@/material-icons/400-24px/navigate_next-fill.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import api from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';

interface Reactions {
  heart: { me: boolean; others: boolean };
}

const AUTO_ADVANCE_MS = 7000;

// ── Media renderer ────────────────────────────────────────────────────────────

const MomentMedia: React.FC<{
  moment: ApiStatusJSON;
  onEnded: () => void;
  paused: boolean;
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
}> = ({ moment, onEnded, paused, mediaRef }) => {
  const attachment = moment.media_attachments[0];

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (paused) {
      el.pause();
    } else {
      void el.play().catch(() => {
        // autoplay may be blocked; that's fine
      });
    }
  }, [paused, mediaRef]);

  if (!attachment) return null;

  if (attachment.type === 'video' || attachment.type === 'gifv') {
    return (
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        className='moment-viewer__video'
        src={attachment.url}
        autoPlay={!paused}
        playsInline
        onEnded={onEnded}
      >
        <track kind='captions' />
      </video>
    );
  }

  if (attachment.type === 'audio') {
    return (
      <audio
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        className='moment-viewer__audio'
        src={attachment.url}
        autoPlay={!paused}
        controls
        onEnded={onEnded}
      >
        <track kind='captions' />
      </audio>
    );
  }

  // image / unknown
  return (
    <img
      className='moment-viewer__image'
      src={attachment.url}
      alt={attachment.description ?? ''}
    />
  );
};

// ── Progress segment ──────────────────────────────────────────────────────────

const ProgressSegment: React.FC<{
  state: 'past' | 'active' | 'future';
  fillPct: number;
}> = ({ state, fillPct }) => (
  <div
    className={`moment-viewer__segment${state === 'past' ? ' moment-viewer__segment--done' : state === 'future' ? ' moment-viewer__segment--future' : ''}`}
  >
    <div
      className='moment-viewer__segment-fill'
      style={state === 'active' ? { width: `${fillPct}%` } : undefined}
    />
  </div>
);

// ── Story viewer ──────────────────────────────────────────────────────────────

export const StoryViewer: React.FC<{
  moments: ApiStatusJSON[];
  onEmpty?: () => void;
}> = ({ moments, onEmpty }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fillPct, setFillPct] = useState(0);
  const [reactionsMap, setReactionsMap] = useState<
    Record<string, Reactions | undefined>
  >(() => {
    const map: Record<string, Reactions | undefined> = {};
    for (const m of moments) {
      map[m.id] = m.moment_reactions as Reactions | undefined;
    }
    return map;
  });
  const [showHeartFloat, setShowHeartFloat] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const goNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % moments.length);
    setFillPct(0);
    elapsedRef.current = 0;
  }, [moments.length]);

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + moments.length) % moments.length);
    setFillPct(0);
    elapsedRef.current = 0;
  }, [moments.length]);

  const handlePlayPause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const handleReactionsUpdate = useCallback(
    (id: string, updated: Reactions) => {
      setReactionsMap((prev) => ({ ...prev, [id]: updated }));
    },
    [],
  );

  const handleHeartClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const momentId = moments[index]?.id;
      if (!momentId) return;
      const currentReactions = reactionsMap[momentId];
      const me = currentReactions?.heart.me ?? false;
      const client = api();
      const request = me
        ? client.delete<Reactions>(
            `/api/v1/statuses/${momentId}/moment_react/heart`,
          )
        : client.post<Reactions>(
            `/api/v1/statuses/${momentId}/moment_react/heart`,
          );
      void request
        .then((res) => {
          const updated = res.data;
          handleReactionsUpdate(momentId, updated);
          if (!me && updated.heart.me) {
            setShowHeartFloat(true);
            setTimeout(() => {
              setShowHeartFloat(false);
            }, 700);
          }
        })
        .catch(() => {
          // ignore
        });
    },
    [moments, index, reactionsMap, handleReactionsUpdate],
  );

  const handleReplyFocus = useCallback(() => {
    setReplyFocused(true);
    setPaused(true);
  }, []);

  const handleReplyBlur = useCallback(() => {
    setReplyFocused(false);
    if (replyText.trim() === '') {
      setPaused(false);
    }
  }, [replyText]);

  const handleReplyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setReplyText(e.target.value);
    },
    [],
  );

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || submittingReply) return;
    const moment = moments[index];
    if (!moment) return;
    setSubmittingReply(true);
    try {
      await api().post('/api/v1/statuses', {
        status: replyText,
        in_reply_to_id: moment.id,
        visibility: 'public',
      });
      setReplyText('');
      setPaused(false);
    } catch {
      // ignore
    } finally {
      setSubmittingReply(false);
    }
  }, [replyText, submittingReply, moments, index]);

  const handleReplySubmit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void handleReply();
    },
    [handleReply],
  );

  const handleReplyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleReply();
      }
    },
    [handleReply],
  );

  const handleTapLeft = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      goPrev();
    },
    [goPrev],
  );

  const handleTapRight = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      goNext();
    },
    [goNext],
  );

  const handleTapLeftKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') handleTapLeft(e);
    },
    [handleTapLeft],
  );

  const handleTapRightKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') handleTapRight(e);
    },
    [handleTapRight],
  );

  // Reset timer refs when index changes
  useEffect(() => {
    startTimeRef.current = Date.now();
    elapsedRef.current = 0;
    setFillPct(0);
    setShowHeartFloat(false);
  }, [index]);

  const moment = moments[index];
  const isMediaMoment =
    (moment?.media_attachments.length ?? 0) > 0 &&
    (moment?.media_attachments[0]?.type === 'video' ||
      moment?.media_attachments[0]?.type === 'gifv' ||
      moment?.media_attachments[0]?.type === 'audio');

  // Pause when reply is focused
  const effectivePaused = paused || replyFocused;

  // Auto-advance timer for text/image moments
  useEffect(() => {
    if (isMediaMoment) return; // media elements fire onEnded themselves
    if (effectivePaused) {
      // store how much elapsed so we can resume from there
      elapsedRef.current += Date.now() - startTimeRef.current;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const total = elapsedRef.current + (Date.now() - startTimeRef.current);
      const pct = Math.min((total / AUTO_ADVANCE_MS) * 100, 100);
      setFillPct(pct);
      if (total >= AUTO_ADVANCE_MS) {
        goNext();
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMediaMoment, effectivePaused, goNext, index]);

  if (!moment) {
    onEmpty?.();
    return null;
  }

  const attachment = moment.media_attachments[0];
  const reactions = reactionsMap[moment.id];
  const heartMe = reactions?.heart.me ?? false;
  const heartOthers = reactions?.heart.others ?? false;

  return (
    <div className='moment-viewer'>
      {/* Progress bar */}
      <div className='moment-viewer__progress'>
        {moments.map((m, i) => (
          <ProgressSegment
            key={m.id}
            state={i < index ? 'past' : i === index ? 'active' : 'future'}
            fillPct={i === index ? fillPct : 0}
          />
        ))}
      </div>

      {/* Content area */}
      <div className='moment-viewer__content'>
        {/* Tap zones */}
        <div
          className='moment-viewer__tap-zone moment-viewer__tap-zone--prev'
          onClick={handleTapLeft}
          onKeyDown={handleTapLeftKey}
          role='button'
          tabIndex={0}
          aria-label='Previous moment'
        />
        <div
          className='moment-viewer__tap-zone moment-viewer__tap-zone--next'
          onClick={handleTapRight}
          onKeyDown={handleTapRightKey}
          role='button'
          tabIndex={0}
          aria-label='Next moment'
        />

        {/* Text always shown if present */}
        {moment.content && (
          <div
            className='moment-viewer__text'
            dangerouslySetInnerHTML={{ __html: moment.content }}
          />
        )}

        {/* Media shown below text */}
        {attachment && (
          <MomentMedia
            moment={moment}
            onEnded={goNext}
            paused={effectivePaused}
            mediaRef={mediaRef}
          />
        )}
      </div>

      {/* Reply input */}
      <div className='moment-viewer__reply'>
        <textarea
          className='moment-viewer__reply-input'
          placeholder='Reply...'
          value={replyText}
          rows={1}
          onChange={handleReplyChange}
          onFocus={handleReplyFocus}
          onBlur={handleReplyBlur}
          onKeyDown={handleReplyKeyDown}
        />
        <button
          type='button'
          className='moment-viewer__reply-send'
          onClick={handleReplySubmit}
          disabled={!replyText.trim() || submittingReply}
          aria-label='Send reply'
        >
          <SendIcon />
        </button>
      </div>

      {/* Playback controls + heart */}
      <div className='moment-viewer__controls'>
        <button type='button' onClick={goPrev} aria-label='Previous'>
          <PrevIcon />
        </button>
        <button
          type='button'
          onClick={handlePlayPause}
          aria-label={effectivePaused ? 'Play' : 'Pause'}
        >
          {effectivePaused ? <PlayArrowIcon /> : <PauseIcon />}
        </button>
        <button type='button' onClick={goNext} aria-label='Next'>
          <NextIcon />
        </button>

        {/* Single heart button */}
        {reactions !== undefined && (
          <div className='moment-viewer__heart-wrapper'>
            {showHeartFloat && (
              <span className='moment-viewer__heart-float'>❤️</span>
            )}
            <button
              type='button'
              className={`moment-viewer__heart-btn${heartMe ? ' moment-viewer__heart-btn--active' : ''}`}
              onClick={handleHeartClick}
              aria-pressed={heartMe}
              aria-label='heart'
            >
              {heartMe ? (
                <FavoriteIcon
                  style={{ fill: '#c97d3a', width: 24, height: 24 }}
                />
              ) : (
                <FavoriteBorderIcon style={{ width: 24, height: 24 }} />
              )}
              {heartOthers && <span className='moment-viewer__reaction-dot' />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
