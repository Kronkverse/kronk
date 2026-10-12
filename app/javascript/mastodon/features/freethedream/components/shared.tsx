import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiFtdComment, apiFtdRemoveComment } from 'mastodon/api/freethedream';
import type {
  FtdAccount,
  FtdCategory,
  FtdComment,
  FtdItemKind,
  FtdRef,
} from 'mastodon/api_types/freethedream';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

// Bits every FreeTheDream page shares: people, breadcrumbs, the comment
// thread, labels for kinds and categories, and a small loader hook.

export const CATEGORIES: FtdCategory[] = [
  'skills',
  'things',
  'space',
  'time',
  'money',
  'connections',
];

export const categoryMessages = defineMessages({
  skills: { id: 'freethedream.category.skills', defaultMessage: 'Skills' },
  things: { id: 'freethedream.category.things', defaultMessage: 'Things' },
  space: { id: 'freethedream.category.space', defaultMessage: 'Space' },
  time: { id: 'freethedream.category.time', defaultMessage: 'Time' },
  money: { id: 'freethedream.category.money', defaultMessage: 'Money' },
  connections: {
    id: 'freethedream.category.connections',
    defaultMessage: 'Connections',
  },
});

export const kindMessages = defineMessages({
  idea: { id: 'freethedream.kind.idea', defaultMessage: 'Idea' },
  need: { id: 'freethedream.kind.need', defaultMessage: 'Need' },
  job: { id: 'freethedream.kind.job', defaultMessage: 'Job' },
  offer: { id: 'freethedream.kind.offer', defaultMessage: 'Offer' },
});

export const kindPluralMessages = defineMessages({
  idea: { id: 'freethedream.kinds.idea', defaultMessage: 'Ideas' },
  need: { id: 'freethedream.kinds.need', defaultMessage: 'Needs' },
  job: { id: 'freethedream.kinds.job', defaultMessage: 'Jobs' },
  offer: { id: 'freethedream.kinds.offer', defaultMessage: 'Offers' },
});

export const KINDS: FtdItemKind[] = ['need', 'job', 'idea', 'offer'];

const messages = defineMessages({
  nobody: { id: 'freethedream.nobody', defaultMessage: 'Nobody yet' },
  commentPlaceholder: {
    id: 'freethedream.comments.placeholder',
    defaultMessage: 'Add a comment',
  },
  send: { id: 'freethedream.comments.send', defaultMessage: 'Send' },
  remove: { id: 'freethedream.comments.remove', defaultMessage: 'Remove' },
  loading: { id: 'freethedream.loading', defaultMessage: 'Loading…' },
  missing: {
    id: 'freethedream.missing',
    defaultMessage: "This isn't here any more.",
  },
});

// The error the server sent, if it sent one.
export const errorOf = (e: unknown): string | null => {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const response = (e as { response?: { data?: { error?: unknown } } })
      .response;
    const error = response?.data?.error;
    return typeof error === 'string' ? error : null;
  }
  return null;
};

// Load something by key; `reload` fetches again, `set` replaces it with a
// fresh copy an action returned.
export function useLoaded<T>(
  key: string,
  load: () => Promise<T>,
): {
  data: T | null;
  failed: boolean;
  set: (next: T) => void;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stale = false;
    setFailed(false);
    load()
      .then((result) => {
        if (!stale) setData(result);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
    // `load` is rebuilt every render; the key says when to fetch again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return { data, failed, set: setData, reload };
}

export const Loading: React.FC<{ failed?: boolean }> = ({ failed }) => {
  const intl = useIntl();
  return (
    <p className='freethedream__quiet'>
      {intl.formatMessage(failed ? messages.missing : messages.loading)}
    </p>
  );
};

export const Person: React.FC<{ account: FtdAccount | null }> = ({
  account,
}) => {
  const intl = useIntl();
  if (!account)
    return (
      <span className='freethedream-person freethedream-person--none'>
        {intl.formatMessage(messages.nobody)}
      </span>
    );

  return (
    <Link to={`/@${account.acct}`} className='freethedream-person'>
      <img
        className='freethedream-person__avatar'
        src={account.avatar}
        alt=''
      />
      <span className='freethedream-person__name'>{account.display_name}</span>
    </Link>
  );
};

export const People: React.FC<{ accounts: FtdAccount[] }> = ({ accounts }) => (
  <ul className='freethedream-people'>
    {accounts.map((a) => (
      <li key={a.id}>
        <Person account={a} />
      </li>
    ))}
  </ul>
);

// Root › Parent › … — every step a link.
export const Crumbs: React.FC<{ trail: FtdRef[] }> = ({ trail }) =>
  trail.length === 0 ? null : (
    <nav className='freethedream-crumbs'>
      {trail.map((step, i) => (
        <span key={step.id} className='freethedream-crumbs__step'>
          {i > 0 && (
            <span className='freethedream-crumbs__sep' aria-hidden='true'>
              ›
            </span>
          )}
          <Link to={`/hub/freethedream/p/${step.id}`}>{step.title}</Link>
        </span>
      ))}
    </nav>
  );

export const Section: React.FC<{
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, aside, children }) => (
  <section className='freethedream-section'>
    <header className='freethedream-section__head'>
      <h3 className='freethedream-section__title'>{title}</h3>
      {aside}
    </header>
    {children}
  </section>
);

interface CommentsProps {
  subjectType: 'project' | 'item';
  subjectId: string;
  comments: FtdComment[];
  canComment: boolean;
}

// The short thread on a project, part or item.
export const Comments: React.FC<CommentsProps> = ({
  subjectType,
  subjectId,
  comments: initial,
  canComment,
}) => {
  const intl = useIntl();
  const [comments, setComments] = useState(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setComments(initial);
  }, [initial]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!draft.trim() || busy) return;
      setBusy(true);
      setError(null);
      apiFtdComment(subjectType, subjectId, draft.trim())
        .then((next) => {
          setComments(next);
          setDraft('');
          setBusy(false);
        })
        .catch((err: unknown) => {
          setError(errorOf(err));
          setBusy(false);
        });
    },
    [draft, busy, subjectType, subjectId],
  );

  const handleRemove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    void apiFtdRemoveComment(id).then(() => {
      setComments((prev) => prev.filter((c) => c.id !== id));
    });
  }, []);

  if (comments.length === 0 && !canComment) return null;

  return (
    <Section
      title={
        <FormattedMessage
          id='freethedream.comments.title'
          defaultMessage='Comments'
        />
      }
    >
      {comments.length > 0 && (
        <ul className='freethedream-comments'>
          {comments.map((c) => (
            <li key={c.id} className='freethedream-comments__row'>
              <div className='freethedream-comments__meta'>
                <Person account={c.account} />
                <RelativeTimestamp timestamp={c.created_at} />
                {c.mine && (
                  <button
                    type='button'
                    className='freethedream__link'
                    data-id={c.id}
                    onClick={handleRemove}
                  >
                    {intl.formatMessage(messages.remove)}
                  </button>
                )}
              </div>
              <p className='freethedream-comments__body'>{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canComment && (
        <form className='freethedream-comments__form' onSubmit={handleSubmit}>
          <textarea
            className='freethedream__input'
            rows={2}
            value={draft}
            onChange={handleChange}
            placeholder={intl.formatMessage(messages.commentPlaceholder)}
            aria-label={intl.formatMessage(messages.commentPlaceholder)}
            maxLength={2000}
          />
          <button
            type='submit'
            className='freethedream__button'
            disabled={busy || !draft.trim()}
          >
            {intl.formatMessage(messages.send)}
          </button>
          {error && (
            <p className='freethedream__error' role='alert'>
              {error}
            </p>
          )}
        </form>
      )}
    </Section>
  );
};

// "3 of 4", with a thin bar under it.
export const Progress: React.FC<{ done: number; of: number }> = ({
  done,
  of,
}) => (
  <span className='freethedream-progress'>
    <span className='freethedream-progress__text'>
      <FormattedMessage
        id='freethedream.progress'
        defaultMessage='{done} of {of}'
        values={{ done: Math.min(done, of), of }}
      />
    </span>
    <span className='freethedream-progress__bar' aria-hidden='true'>
      <span
        className='freethedream-progress__fill'
        style={{ width: `${Math.min(100, (done / Math.max(of, 1)) * 100)}%` }}
      />
    </span>
  </span>
);
