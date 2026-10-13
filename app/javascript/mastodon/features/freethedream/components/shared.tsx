import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type {
  FtdAccount,
  FtdCategory,
  FtdItemKind,
  FtdProgress,
  FtdRef,
} from 'mastodon/api_types/freethedream';

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

// "30 plates", "5 kg rice", "$400": an amount with its unit.
export const formatAmount = (quantity: number, unit: string) =>
  unit === '$' ? `$${quantity}` : unit ? `${quantity} ${unit}` : `${quantity}`;

const UNITS =
  'kg|g|litres?|liters?|l|ml|m|bags?|packs?|boxes|box|bottles?|cans?|rolls?|cartons?|crates?|dozen|loaves|bunch(?:es)?|hours?|hrs?|sheets?|metres?|meters?';
const LEADING = new RegExp(
  `^(\\$)?\\s*(\\d+)\\s*(${UNITS})?\\s+(?:x\\s+|of\\s+)?(.+)$`,
  'i',
);
const TRAILING = /^(.+?)\s*[x×]\s*(\d+)$/i;

// Read one line the way people write it: "30 plates", "5 kg rice",
// "$400 permits", "tarps x4", or just "a generator" (one).
export const parseLine = (
  text: string,
): { quantity: number; unit: string; title: string } => {
  const line = text.trim();
  const lead = LEADING.exec(line);
  if (lead) {
    const [, dollar, amount, unit, title] = lead;
    return {
      quantity: Number.parseInt(amount ?? '1', 10),
      unit: dollar ? '$' : (unit ?? '').toLowerCase(),
      title: (title ?? '').trim(),
    };
  }
  const dollarOnly = /^\$\s*(\d+)$/.exec(line);
  if (dollarOnly)
    return {
      quantity: Number.parseInt(dollarOnly[1] ?? '1', 10),
      unit: '$',
      title: '',
    };
  const trail = TRAILING.exec(line);
  if (trail)
    return {
      quantity: Number.parseInt(trail[2] ?? '1', 10),
      unit: '',
      title: (trail[1] ?? '').trim(),
    };
  return { quantity: 1, unit: '', title: line };
};

// "18 of 42 sorted · 3 jobs open", with a thin bar.
export const ProgressLine: React.FC<{ progress: FtdProgress }> = ({
  progress,
}) => {
  if (progress.total === 0) return null;
  const all = progress.sorted === progress.total;
  return (
    <div className='freethedream-progress-line'>
      <span>
        {all ? (
          <FormattedMessage
            id='freethedream.progress.all'
            defaultMessage='Everything sorted'
          />
        ) : (
          <FormattedMessage
            id='freethedream.progress.line'
            defaultMessage='{sorted} of {total} sorted{jobs, plural, =0 {} one { · # job open} other { · # jobs open}}'
            values={{
              sorted: progress.sorted,
              total: progress.total,
              jobs: progress.open_jobs,
            }}
          />
        )}
      </span>
      <span className='freethedream-progress__bar' aria-hidden='true'>
        <span
          className='freethedream-progress__fill'
          style={{ width: `${(progress.sorted / progress.total) * 100}%` }}
        />
      </span>
    </div>
  );
};
