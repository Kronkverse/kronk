import { useCallback, useEffect, useRef, useState } from 'react';

import type { MessageDescriptor } from 'react-intl';
import { defineMessages, useIntl } from 'react-intl';

import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import type { Reaction } from '../crowd';
import { fetchMoments, postMoment, REACTIONS } from '../crowd';
import type { BoothLiveMoment, BoothLiveMomentKind } from '../types';

// The crowd on screen in a live set (docs/spaces/booth.md): what
// listeners send (shoutouts, reactions, requests) and the host's Now
// playing, over the call for everyone watching, each for a few seconds.
// The room polls for new ones (useLiveMoments); the host's page also sends
// each into the call for the recorder (crowd.ts).

// How often the room asks for new moments while it's live.
const POLL_MOMENTS_MS = 4_000;
// How long one stays on screen. Matches the fade in _booth_native.scss
// (`--dur-slow` × 15).
const FADE_MS = 6_000;
// At most this many at once; a busy crowd drops the oldest.
const MAX_ON_SCREEN = 5;
const BODY_MAX = 200;

const messages = defineMessages({
  overlay: {
    id: 'booth.live.crowd.overlay',
    defaultMessage: 'From the crowd',
  },
  request: {
    id: 'booth.live.crowd.request',
    defaultMessage: 'Request: {text}',
  },
  track: {
    id: 'booth.live.crowd.track',
    defaultMessage: 'Now playing: {text}',
  },
  reactionFroth: { id: 'booth.live.crowd.froth', defaultMessage: 'Froth' },
  reactionApplause: {
    id: 'booth.live.crowd.applause',
    defaultMessage: 'Applause',
  },
  reactionRewind: { id: 'booth.live.crowd.rewind', defaultMessage: 'Rewind!' },
  placeholder: {
    id: 'booth.live.crowd.placeholder',
    defaultMessage: 'Say something to {name}, or name a track to request',
  },
  shoutOut: { id: 'booth.live.crowd.shout_out', defaultMessage: 'Shout out' },
  requestIt: { id: 'booth.live.crowd.request_it', defaultMessage: 'Request' },
  reactions: { id: 'booth.live.crowd.reactions', defaultMessage: 'React' },
  error: {
    id: 'booth.live.crowd.error',
    defaultMessage: 'Couldn’t send it. Try again in a moment.',
  },
  nowPlayingLabel: {
    id: 'booth.live.now_playing.label',
    defaultMessage: 'Now playing (Artist - Title)',
  },
  markPlaying: {
    id: 'booth.live.now_playing.mark',
    defaultMessage: 'Mark as playing',
  },
  nowPlayingHint: {
    id: 'booth.live.now_playing.hint',
    defaultMessage:
      'Listeners see it, and it goes into your set’s track list with the time.',
  },
});

const REACTION_LABELS: Record<Reaction, MessageDescriptor> = {
  froth: messages.reactionFroth,
  applause: messages.reactionApplause,
  rewind: messages.reactionRewind,
};

const isReaction = (text: string): text is Reaction =>
  (REACTIONS as readonly string[]).includes(text);

// New moments in a live set, as they come. `onNew` gets each one once:
// the first answer is what was already there, so it isn't shown again.
// Returns `addLocal`, for a moment this page just sent, so it shows at
// once and isn't shown again when the next poll brings it.
export const useLiveMoments = (
  liveId: string,
  active: boolean,
  onNew: (moments: BoothLiveMoment[]) => void,
): ((moment: BoothLiveMoment) => void) => {
  const onNewRef = useRef(onNew);
  const sinceRef = useRef<string | null>(null);
  const seenRef = useRef(new Set<string>());
  const primedRef = useRef(false);

  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const found = await fetchMoments(liveId, sinceRef.current);
        if (cancelled) return;
        const last = found[found.length - 1];
        if (last) sinceRef.current = last.id;
        const fresh = found.filter((m) => !seenRef.current.has(m.id));
        fresh.forEach((m) => seenRef.current.add(m.id));
        if (primedRef.current && fresh.length > 0) onNewRef.current(fresh);
        primedRef.current = true;
      } catch {
        // Try again on the next round.
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MOMENTS_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveId, active]);

  return useCallback((moment: BoothLiveMoment) => {
    if (seenRef.current.has(moment.id)) return;
    seenRef.current.add(moment.id);
    onNewRef.current([moment]);
  }, []);
};

// The newest few, for the overlay: adds and drops, each leaving after
// FADE_MS.
export const useCrowdOnScreen = (): [
  BoothLiveMoment[],
  (moments: BoothLiveMoment[]) => void,
  (id: string) => void,
] => {
  const [shown, setShown] = useState<BoothLiveMoment[]>([]);
  const show = useCallback((moments: BoothLiveMoment[]) => {
    setShown((current) => [...current, ...moments].slice(-MAX_ON_SCREEN));
  }, []);
  const done = useCallback((id: string) => {
    setShown((current) => current.filter((m) => m.id !== id));
  }, []);
  return [shown, show, done];
};

// What one moment says on screen.
const useMomentLine = () => {
  const intl = useIntl();
  return useCallback(
    (moment: BoothLiveMoment): string => {
      switch (moment.kind) {
        case 'reaction':
          return isReaction(moment.text)
            ? intl.formatMessage(REACTION_LABELS[moment.text])
            : moment.text;
        case 'request':
          return intl.formatMessage(messages.request, { text: moment.text });
        case 'track':
          return intl.formatMessage(messages.track, { text: moment.text });
        default:
          return moment.text;
      }
    },
    [intl],
  );
};

const CrowdItem: React.FC<{
  moment: BoothLiveMoment;
  line: string;
  onDone: (id: string) => void;
}> = ({ moment, line, onDone }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDone(moment.id);
    }, FADE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [moment.id, onDone]);

  return (
    <li
      className={`booth-live-crowd__item booth-live-crowd__item--${moment.kind}`}
    >
      <img
        className='booth-live-crowd__avatar'
        src={moment.account.avatar}
        alt=''
      />
      <span className='booth-live-crowd__name'>
        {moment.account.display_name}
      </span>
      <span className='booth-live-crowd__text'>{line}</span>
    </li>
  );
};

// Over the call, for everyone watching. Read out politely by screen
// readers; no movement for people who asked for less (the stylesheet's
// prefers-reduced-motion).
export const CrowdOverlay: React.FC<{
  moments: BoothLiveMoment[];
  onDone: (id: string) => void;
}> = ({ moments, onDone }) => {
  const intl = useIntl();
  const line = useMomentLine();

  return (
    <ul
      className='booth-live-crowd'
      aria-live='polite'
      aria-label={intl.formatMessage(messages.overlay)}
    >
      {moments.map((moment) => (
        <CrowdItem
          key={moment.id}
          moment={moment}
          line={line(moment)}
          onDone={onDone}
        />
      ))}
    </ul>
  );
};

// A listener's side: a shoutout or a request, and the reactions.
export const CrowdComposer: React.FC<{
  liveId: string;
  hostName: string;
  onSent: (moment: BoothLiveMoment) => void;
}> = ({ liveId, hostName, onSent }) => {
  const intl = useIntl();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const send = useCallback(
    (kind: BoothLiveMomentKind, text: string) => {
      setSending(true);
      setError(false);
      postMoment(liveId, kind, text)
        .then((moment) => {
          onSent(moment);
          if (kind !== 'reaction') setBody('');
          setSending(false);
          return undefined;
        })
        .catch(() => {
          setError(true);
          setSending(false);
        });
    },
    [liveId, onSent],
  );

  const handleBody = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBody(e.target.value);
  }, []);
  const handleShoutout = useCallback(() => {
    if (body.trim()) send('shoutout', body.trim());
  }, [body, send]);
  const handleRequest = useCallback(() => {
    if (body.trim()) send('request', body.trim());
  }, [body, send]);
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleShoutout();
    },
    [handleShoutout],
  );
  const handleReaction = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const reaction = e.currentTarget.dataset.reaction;
      if (reaction && isReaction(reaction)) send('reaction', reaction);
    },
    [send],
  );

  const placeholder = intl.formatMessage(messages.placeholder, {
    name: hostName,
  });
  const empty = body.trim() === '';

  return (
    <div className='booth-live-crowd-compose'>
      <form className='booth-shoutouts__compose' onSubmit={handleSubmit}>
        <input
          type='text'
          value={body}
          onChange={handleBody}
          maxLength={BODY_MAX}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={sending}
        />
        <KornerPill
          variant='primary'
          label={intl.formatMessage(messages.shoutOut)}
          onClick={handleShoutout}
          disabled={sending || empty}
        />
        <KornerPill
          label={intl.formatMessage(messages.requestIt)}
          onClick={handleRequest}
          disabled={sending || empty}
        />
      </form>
      <div
        className='booth-live-crowd-compose__reactions'
        role='group'
        aria-label={intl.formatMessage(messages.reactions)}
      >
        {REACTIONS.map((reaction) => (
          <button
            key={reaction}
            type='button'
            className='booth-live-crowd-compose__reaction'
            data-reaction={reaction}
            onClick={handleReaction}
            disabled={sending}
          >
            {intl.formatMessage(REACTION_LABELS[reaction])}
          </button>
        ))}
      </div>
      {error && (
        <p className='booth-shoutouts__error' role='alert'>
          {intl.formatMessage(messages.error)}
        </p>
      )}
    </div>
  );
};

// The host's side: mark what's playing. It shows to listeners, goes into
// the call, and becomes the set's track list.
export const NowPlayingForm: React.FC<{
  liveId: string;
  onSent: (moment: BoothLiveMoment) => void;
}> = ({ liveId, onSent }) => {
  const intl = useIntl();
  const [track, setTrack] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const handleTrack = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTrack(e.target.value);
  }, []);
  const mark = useCallback(() => {
    const text = track.trim();
    if (!text) return;
    setSending(true);
    setError(false);
    postMoment(liveId, 'track', text)
      .then((moment) => {
        onSent(moment);
        setTrack('');
        setSending(false);
        return undefined;
      })
      .catch(() => {
        setError(true);
        setSending(false);
      });
  }, [liveId, track, onSent]);
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mark();
    },
    [mark],
  );

  const label = intl.formatMessage(messages.nowPlayingLabel);

  return (
    <div className='booth-live-crowd-compose'>
      <form className='booth-shoutouts__compose' onSubmit={handleSubmit}>
        <input
          type='text'
          value={track}
          onChange={handleTrack}
          maxLength={BODY_MAX * 2}
          placeholder={label}
          aria-label={label}
          disabled={sending}
        />
        <KornerActionBar>
          <KornerPill
            variant='primary'
            label={intl.formatMessage(messages.markPlaying)}
            onClick={mark}
            disabled={sending || track.trim() === ''}
          />
        </KornerActionBar>
      </form>
      <p className='booth-shoutouts__hint'>
        {intl.formatMessage(messages.nowPlayingHint)}
      </p>
      {error && (
        <p className='booth-shoutouts__error' role='alert'>
          {intl.formatMessage(messages.error)}
        </p>
      )}
    </div>
  );
};
