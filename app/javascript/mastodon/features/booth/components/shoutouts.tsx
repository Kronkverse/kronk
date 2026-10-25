import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { useBoothPlayback } from '../booth_playback_context';
import { formatDuration } from '../format';
import type { BoothSet, BoothShoutout } from '../types';

// Shoutouts on a set (docs/spaces/booth.md, Shoutouts): listeners' notes,
// pinned to a moment when they're listening. A pinned shoutout shows on
// the player's progress bar too, and its time jumps the set there. Each
// one reaches the artist as a Nudge.

const BODY_MAX = 500;

const messages = defineMessages({
  heading: { id: 'booth.shoutouts.heading', defaultMessage: 'Shoutouts' },
  placeholder: {
    id: 'booth.shoutouts.placeholder',
    defaultMessage: 'Shout out {name}…',
  },
  atTime: { id: 'booth.shoutouts.at_time', defaultMessage: 'at {time}' },
  send: { id: 'booth.shoutouts.send', defaultMessage: 'Send' },
  sending: { id: 'booth.shoutouts.sending', defaultMessage: 'Sending…' },
  hint: {
    id: 'booth.shoutouts.hint',
    defaultMessage:
      'Play the set to pin your shoutout to the moment you’re hearing. {name} gets it in Nudges.',
  },
  empty: {
    id: 'booth.shoutouts.empty',
    defaultMessage: 'No shoutouts yet',
  },
  emptyBody: {
    id: 'booth.shoutouts.empty_body',
    defaultMessage:
      'Tell them what you loved. It means more than a play count.',
  },
  jump: { id: 'booth.shoutouts.jump', defaultMessage: 'Play from {time}' },
  remove: { id: 'booth.shoutouts.remove', defaultMessage: 'Remove' },
  removeTitle: {
    id: 'booth.shoutouts.remove_title',
    defaultMessage: 'Remove this shoutout?',
  },
  error: {
    id: 'booth.shoutouts.error',
    defaultMessage: 'Could not send it. Try again.',
  },
});

// The set's shoutouts, newest first, loaded once per set.
export function useShoutouts(setId: string | undefined): {
  shoutouts: BoothShoutout[];
  setShoutouts: React.Dispatch<React.SetStateAction<BoothShoutout[]>>;
} {
  const [shoutouts, setShoutouts] = useState<BoothShoutout[]>([]);

  useEffect(() => {
    if (!setId) return undefined;
    let cancelled = false;
    api()
      .get<BoothShoutout[]>(`/api/v1/booth_sets/${setId}/shoutouts`)
      .then((res) => {
        if (!cancelled) setShoutouts(res.data);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setId]);

  return { shoutouts, setShoutouts };
}

const ShoutoutItem: React.FC<{
  set: BoothSet;
  shoutout: BoothShoutout;
  onRemove: (shoutout: BoothShoutout) => void;
}> = ({ set, shoutout, onRemove }) => {
  const intl = useIntl();
  const { playFrom } = useBoothPlayback();
  const at = shoutout.at_seconds;

  const handleJump = useCallback(() => {
    if (at !== null) playFrom(set, at);
  }, [playFrom, set, at]);
  const handleRemove = useCallback(() => {
    onRemove(shoutout);
  }, [onRemove, shoutout]);

  return (
    <li className='booth-shoutout'>
      <img
        className='booth-shoutout__avatar'
        src={shoutout.account.avatar}
        alt=''
      />
      <div className='booth-shoutout__body'>
        <div className='booth-shoutout__head'>
          <Link to={`/@${shoutout.account.acct}`}>
            {shoutout.account.display_name}
          </Link>
          {at !== null && (
            <button
              type='button'
              className='booth-shoutout__at'
              onClick={handleJump}
              aria-label={intl.formatMessage(messages.jump, {
                time: formatDuration(at) || '0:00',
              })}
            >
              {formatDuration(at) || '0:00'}
            </button>
          )}
          {shoutout.can_remove && (
            <button
              type='button'
              className='booth-shoutout__remove'
              onClick={handleRemove}
            >
              {intl.formatMessage(messages.remove)}
            </button>
          )}
        </div>
        <p>{shoutout.body}</p>
      </div>
    </li>
  );
};

interface Props {
  set: BoothSet;
  shoutouts: BoothShoutout[];
  setShoutouts: React.Dispatch<React.SetStateAction<BoothShoutout[]>>;
}

export const Shoutouts: React.FC<Props> = ({
  set,
  shoutouts,
  setShoutouts,
}) => {
  const intl = useIntl();
  const { activeSet, currentTime } = useBoothPlayback();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [body, setBody] = useState('');
  const [pin, setPin] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only a set that's playing (or paused mid-way) has a moment to pin to.
  const listening = activeSet?.id === set.id && currentTime > 0;
  const artist = set.artists[0]?.account?.display_name ?? set.artist_name;

  const handleBody = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBody(e.target.value);
    setError(null);
  }, []);
  const handlePin = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPin(e.target.checked);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = body.trim();
      if (!text) return;
      setSending(true);
      void api()
        .post<BoothShoutout>(`/api/v1/booth_sets/${set.id}/shoutouts`, {
          body: text,
          at_seconds: listening && pin ? Math.floor(currentTime) : undefined,
        })
        .then((res) => {
          setShoutouts((prev) => [res.data, ...prev]);
          setBody('');
          setSending(false);
          return undefined;
        })
        .catch(() => {
          setError(intl.formatMessage(messages.error));
          setSending(false);
        });
    },
    [body, set.id, listening, pin, currentTime, setShoutouts, intl],
  );

  const handleRemove = useCallback(
    (shoutout: BoothShoutout) => {
      void (async () => {
        const ok = await confirm({
          title: intl.formatMessage(messages.removeTitle),
          confirmLabel: intl.formatMessage(messages.remove),
          destructive: true,
        });
        if (!ok) return;
        await api().delete(`/api/v1/booth_shoutouts/${shoutout.id}`);
        setShoutouts((prev) => prev.filter((s) => s.id !== shoutout.id));
      })();
    },
    [confirm, intl, setShoutouts],
  );

  return (
    <section className='booth-set__section booth-shoutouts'>
      <h2 className='booth-set__section-title'>
        {intl.formatMessage(messages.heading)}
        {shoutouts.length > 0 && (
          <span className='booth-shoutouts__count'>{shoutouts.length}</span>
        )}
      </h2>

      <form className='booth-shoutouts__compose' onSubmit={handleSubmit}>
        <input
          type='text'
          value={body}
          onChange={handleBody}
          maxLength={BODY_MAX}
          placeholder={intl.formatMessage(messages.placeholder, {
            name: artist,
          })}
          aria-label={intl.formatMessage(messages.placeholder, {
            name: artist,
          })}
          disabled={sending}
        />
        {listening && (
          <label className='booth-shoutouts__pin'>
            <input type='checkbox' checked={pin} onChange={handlePin} />
            {intl.formatMessage(messages.atTime, {
              time: formatDuration(Math.floor(currentTime)) || '0:00',
            })}
          </label>
        )}
        <button
          type='submit'
          className='booth-shoutouts__send'
          disabled={sending || body.trim() === ''}
        >
          {intl.formatMessage(sending ? messages.sending : messages.send)}
        </button>
      </form>
      {error && <p className='booth-shoutouts__error'>{error}</p>}
      {!listening && (
        <p className='booth-shoutouts__hint'>
          {intl.formatMessage(messages.hint, { name: artist })}
        </p>
      )}

      {shoutouts.length > 0 ? (
        <ul className='booth-shoutouts__list'>
          {shoutouts.map((s) => (
            <ShoutoutItem
              key={s.id}
              set={set}
              shoutout={s}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title={intl.formatMessage(messages.empty)}
          body={intl.formatMessage(messages.emptyBody)}
        />
      )}

      {confirmDialog}
    </section>
  );
};
