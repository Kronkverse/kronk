import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { isAxiosError } from 'axios';

import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import LockOpenIcon from '@/material-icons/400-24px/lock_open.svg?react';
import { apiAskForListing } from 'mastodon/api/wachuneed_requests';
import type {
  ApiLessonMediaJSON,
  ApiListingJSON,
} from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LinkifiedText } from 'mastodon/components/linkified_text';

// A lesson on its listing page (docs/spaces/wachuneed.md, Lessons). Locked,
// it shows what is in it, how to pay the seller, and Unlock: a request to
// the seller, who hears it in Nudges and lets the person in, or doesn't,
// from Requests. Kronk takes no payment; the seller decides. Unlocked (the
// seller, someone let in, or anyone when it is free or for a donation), it
// shows the lesson itself. The server only sends the lesson to someone who
// may open it.

const messages = defineMessages({
  locked: {
    id: 'wachuneed.lesson.locked',
    defaultMessage: 'This lesson is locked',
  },
  lockedHint: {
    id: 'wachuneed.lesson.locked_hint',
    defaultMessage:
      'Pay {name}, then ask to unlock it. They’ll let you in when they see it.',
  },
  pwywHint: {
    id: 'wachuneed.lesson.pwyw_hint',
    defaultMessage:
      'Pay {name} what you think it’s worth, then ask to unlock it. They’ll let you in when they see it.',
  },
  videos: {
    id: 'wachuneed.lesson.videos',
    defaultMessage: '{count, plural, one {# video} other {# videos}}',
  },
  recordings: {
    id: 'wachuneed.lesson.recordings',
    defaultMessage: '{count, plural, one {# recording} other {# recordings}}',
  },
  pictures: {
    id: 'wachuneed.lesson.pictures',
    defaultMessage: '{count, plural, one {# picture} other {# pictures}}',
  },
  notes: { id: 'wachuneed.lesson.notes', defaultMessage: 'notes' },
  payTo: { id: 'wachuneed.lesson.pay_to', defaultMessage: 'How to pay {name}' },
  support: {
    id: 'wachuneed.lesson.support',
    defaultMessage: 'Support {name}',
  },
  supportHint: {
    id: 'wachuneed.lesson.support_hint',
    defaultMessage:
      '{name} shares this for a donation. If it helps you, here’s how to pay them:',
  },
  unlock: { id: 'wachuneed.lesson.unlock', defaultMessage: 'Unlock' },
  unlockAgain: {
    id: 'wachuneed.lesson.unlock_again',
    defaultMessage: 'Ask again',
  },
  amount: {
    id: 'wachuneed.lesson.amount',
    defaultMessage: 'What you paid or will pay (A$)',
  },
  message: {
    id: 'wachuneed.lesson.message',
    defaultMessage: 'A note for {name}, e.g. how you paid (optional)',
  },
  asked: {
    id: 'wachuneed.lesson.asked',
    defaultMessage: 'Asked. {name} will let you in when they see it.',
  },
  declined: {
    id: 'wachuneed.lesson.declined',
    defaultMessage:
      '{name} hasn’t let you in. You can message them, or ask again.',
  },
  seeRequests: {
    id: 'wachuneed.lesson.see_requests',
    defaultMessage: 'Your requests',
  },
  signIn: {
    id: 'wachuneed.lesson.sign_in',
    defaultMessage: 'Sign in to unlock it.',
  },
  yours: {
    id: 'wachuneed.lesson.yours',
    defaultMessage:
      'Only you and the people you let in see this. Requests to unlock it arrive in Nudges and in Requests.',
  },
  yoursOpen: {
    id: 'wachuneed.lesson.yours_open',
    defaultMessage: 'Everyone who can see this listing can open the lesson.',
  },
  requests: {
    id: 'wachuneed.lesson.requests',
    defaultMessage: 'See requests',
  },
  unlocked: { id: 'wachuneed.lesson.unlocked', defaultMessage: 'The lesson' },
  failed: {
    id: 'wachuneed.lesson.failed',
    defaultMessage: 'That did not go through. Try again?',
  },
});

const LessonMedia: React.FC<{ media: ApiLessonMediaJSON }> = ({ media }) => {
  if (media.type === 'video')
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- the seller's own upload; no captions to offer
      <video
        className='wachuneed-lesson__video'
        src={media.url}
        poster={media.preview_url ?? undefined}
        controls
        playsInline
        preload='metadata'
        aria-label={media.description ?? undefined}
      />
    );
  if (media.type === 'audio')
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- as above
      <audio
        className='wachuneed-lesson__audio'
        src={media.url}
        controls
        preload='metadata'
        aria-label={media.description ?? undefined}
      />
    );
  return (
    <a href={media.url} target='_blank' rel='noopener noreferrer'>
      <img
        className='wachuneed-lesson__image'
        src={media.preview_url ?? media.url}
        alt={media.description ?? ''}
      />
    </a>
  );
};

export const LessonSection: React.FC<{
  listing: ApiListingJSON;
  isOwner: boolean;
  // Signed in, and allowed to ask: someone who can see it, while it's up.
  canAsk: boolean;
  signedIn: boolean;
}> = ({ listing, isOwner, canAsk, signedIn }) => {
  const intl = useIntl();
  const lesson = listing.lesson;
  const name = listing.account
    ? listing.account.display_name !== ''
      ? listing.account.display_name
      : listing.account.acct
    : '';
  const [asked, setAsked] = useState(listing.my_request?.state === 'pending');
  const declined = !asked && listing.my_request?.state === 'declined';
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pwyw = listing.price_type === 'offers';

  const handleAmount = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setAmount(e.currentTarget.value);
    },
    [],
  );
  const handleNote = useCallback<React.ChangeEventHandler<HTMLTextAreaElement>>(
    (e) => {
      setNote(e.currentTarget.value);
    },
    [],
  );

  const handleUnlock = useCallback(() => {
    setBusy(true);
    setError(null);
    const cents = Math.round(Number(amount) * 100);
    apiAskForListing(listing.id, {
      quantity: 1,
      message: note.trim() || undefined,
      ...(pwyw && amount.trim() && Number.isFinite(cents) && cents >= 0
        ? { amount_cents: cents }
        : {}),
    })
      .then(() => {
        setAsked(true);
        setBusy(false);
        return undefined;
      })
      .catch((e: unknown) => {
        const said: unknown = isAxiosError(e)
          ? (e.response?.data as { error?: unknown } | undefined)?.error
          : null;
        setError(
          typeof said === 'string' ? said : intl.formatMessage(messages.failed),
        );
        setBusy(false);
      });
  }, [amount, intl, listing.id, note, pwyw]);

  if (!lesson) return null;

  const payDetails = listing.pay_details?.trim();

  if (lesson.unlocked) {
    return (
      <section className='wachuneed-lesson wachuneed-lesson--open'>
        <h2 className='korner-section-heading'>
          <Icon id='lock_open' icon={LockOpenIcon} />
          {intl.formatMessage(messages.unlocked)}
        </h2>
        {isOwner && (
          <p className='wachuneed-lesson__hint'>
            {intl.formatMessage(
              lesson.open ? messages.yoursOpen : messages.yours,
            )}{' '}
            {!lesson.open && (
              <Link to='/hub/wachuneed/mine'>
                {intl.formatMessage(messages.requests)}
              </Link>
            )}
          </p>
        )}
        {(lesson.media ?? []).map((media) => (
          <LessonMedia key={media.id} media={media} />
        ))}
        {lesson.body && (
          <div className='wachuneed-lesson__body'>
            <LinkifiedText text={lesson.body} />
          </div>
        )}
        {lesson.open && !isOwner && payDetails && (
          <div className='wachuneed-lesson__pay'>
            <h3>{intl.formatMessage(messages.support, { name })}</h3>
            <p>{intl.formatMessage(messages.supportHint, { name })}</p>
            <p className='wachuneed-lesson__pay-details'>
              <LinkifiedText text={payDetails} />
            </p>
          </div>
        )}
      </section>
    );
  }

  // What is in it, without any of it: "2 videos · 1 recording · notes".
  const counts = lesson.counts;
  const contents = [
    counts.video
      ? intl.formatMessage(messages.videos, { count: counts.video })
      : null,
    counts.audio
      ? intl.formatMessage(messages.recordings, { count: counts.audio })
      : null,
    counts.image
      ? intl.formatMessage(messages.pictures, { count: counts.image })
      : null,
    lesson.has_text ? intl.formatMessage(messages.notes) : null,
  ].filter(Boolean);

  return (
    <section className='wachuneed-lesson wachuneed-lesson--locked'>
      <h2 className='korner-section-heading'>
        <Icon id='lock' icon={LockIcon} />
        {intl.formatMessage(messages.locked)}
      </h2>
      {contents.length > 0 && (
        <p className='wachuneed-lesson__contents'>{contents.join(' · ')}</p>
      )}
      <p className='wachuneed-lesson__hint'>
        {intl.formatMessage(pwyw ? messages.pwywHint : messages.lockedHint, {
          name,
        })}
      </p>
      {payDetails && (
        <div className='wachuneed-lesson__pay'>
          <h3>{intl.formatMessage(messages.payTo, { name })}</h3>
          <p className='wachuneed-lesson__pay-details'>
            <LinkifiedText text={payDetails} />
          </p>
        </div>
      )}

      {!signedIn ? (
        <p className='wachuneed-lesson__hint'>
          {intl.formatMessage(messages.signIn)}
        </p>
      ) : asked ? (
        <p className='wachuneed-detail__asked' role='status'>
          {intl.formatMessage(messages.asked, { name })}{' '}
          <Link to='/hub/wachuneed/mine'>
            {intl.formatMessage(messages.seeRequests)}
          </Link>
        </p>
      ) : canAsk ? (
        <div className='wachuneed-lesson__unlock'>
          {declined && (
            <p className='wachuneed-lesson__hint'>
              {intl.formatMessage(messages.declined, { name })}
            </p>
          )}
          {pwyw && (
            <label className='wachuneed-lesson__field'>
              <span>{intl.formatMessage(messages.amount)}</span>
              <input
                type='number'
                min={0}
                step={0.01}
                className='wachuneed__compose-input'
                value={amount}
                onChange={handleAmount}
              />
            </label>
          )}
          <textarea
            className='wachuneed__compose-input wachuneed-lesson__note'
            rows={2}
            maxLength={1000}
            value={note}
            onChange={handleNote}
            placeholder={intl.formatMessage(messages.message, { name })}
            aria-label={intl.formatMessage(messages.message, { name })}
          />
          <KornerPill
            label={intl.formatMessage(
              declined ? messages.unlockAgain : messages.unlock,
            )}
            icon={LockOpenIcon}
            iconId='lock_open'
            variant='primary'
            onClick={handleUnlock}
            disabled={busy}
          />
          {error && (
            <p className='wachuneed__compose-hint' role='alert'>
              {error}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
};
