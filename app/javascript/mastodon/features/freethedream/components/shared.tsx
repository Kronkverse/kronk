import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type {
  FtdAccount,
  FtdCategory,
  FtdItemKind,
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
  need: { id: 'freethedream.kind.bring', defaultMessage: 'To bring' },
  job: { id: 'freethedream.kind.actualise', defaultMessage: 'To actualise' },
  offer: { id: 'freethedream.kind.offer', defaultMessage: 'Offer' },
});

export const kindPluralMessages = defineMessages({
  idea: { id: 'freethedream.kinds.idea', defaultMessage: 'Ideas' },
  need: { id: 'freethedream.bring.title', defaultMessage: 'Thing Bringing' },
  job: { id: 'freethedream.actualise.title', defaultMessage: 'Actualise' },
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

// A project's page, by name (decisions.md, 2026-10-22). `rest` is a list
// under it, like '/actualise'.
export const projectPath = (
  project: { id: string; slug?: string },
  rest = '',
): string => `/hub/freethedream/p/${project.slug ?? project.id}${rest}`;

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
          <Link to={projectPath(step)}>{step.title}</Link>
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

// How many a need asks for: "2 gas bottles", or "20+ plates" when more is
// welcome. More is better at an event as a general idea, not a rule (Tal,
// 2026-10-19: "we don't need 20 gas bottles"), so whoever adds a need says
// whether more is welcome, by typing "20+ plates" or ticking the box.
export const formatNeed = (
  quantity: number,
  unit: string,
  moreWelcome = false,
) => {
  if (!moreWelcome) return formatAmount(quantity, unit);
  return unit === '$'
    ? `$${quantity}+`
    : unit
      ? `${quantity}+ ${unit}`
      : `${quantity}+`;
};

// "30 plates", "5 kg rice", "$400": an amount with its unit.
export const formatAmount = (quantity: number, unit: string) =>
  unit === '$' ? `$${quantity}` : unit ? `${quantity} ${unit}` : `${quantity}`;

const UNITS =
  'kg|g|litres?|liters?|l|ml|m|bags?|packs?|boxes|box|bottles?|cans?|rolls?|cartons?|crates?|dozen|loaves|bunch(?:es)?|hours?|hrs?|sheets?|metres?|meters?';
const LEADING = new RegExp(
  `^(\\$)?\\s*(\\d+)\\s*(\\+)?\\s*(${UNITS})?\\s+(?:x\\s+|of\\s+)?(.+)$`,
  'i',
);
const TRAILING = /^(.+?)\s*[x×]\s*(\d+)(\+)?$/i;

// Read one line the way people write it: "30 plates", "5 kg rice",
// "$400 permits", "tarps x4", or just "a generator" (one). A + after the
// number, "20+ plates", says more is welcome.
export const parseLine = (
  text: string,
): { quantity: number; unit: string; title: string; more: boolean } => {
  const line = text.trim();
  const lead = LEADING.exec(line);
  if (lead) {
    const [, dollar, amount, plus, unit, title] = lead;
    return {
      quantity: Number.parseInt(amount ?? '1', 10),
      unit: dollar ? '$' : (unit ?? '').toLowerCase(),
      title: (title ?? '').trim(),
      more: !!plus,
    };
  }
  const dollarOnly = /^\$\s*(\d+)(\+)?$/.exec(line);
  if (dollarOnly)
    return {
      quantity: Number.parseInt(dollarOnly[1] ?? '1', 10),
      unit: '$',
      title: '',
      more: !!dollarOnly[2],
    };
  const trail = TRAILING.exec(line);
  if (trail)
    return {
      quantity: Number.parseInt(trail[2] ?? '1', 10),
      unit: '',
      title: (trail[1] ?? '').trim(),
      more: !!trail[3],
    };
  return { quantity: 1, unit: '', title: line, more: false };
};

// The More welcome toggle beside a line being typed: puts the + after its
// number, or takes it away ("20 plates" ⇄ "20+ plates", "tarps x4" ⇄
// "tarps x4+"). The text stays the one place it's said.
export const togglePlus = (text: string) => {
  const lead = /^(\s*\$?\s*\d+)(\s*\+)?/.exec(text);
  if (lead?.[1])
    return lead[2]
      ? lead[1] + text.slice(lead[0].length)
      : `${lead[1]}+${text.slice(lead[1].length)}`;
  const trail = /(\d+)(\+)?\s*$/.exec(text);
  if (trail?.[1])
    return `${text.slice(0, trail.index)}${trail[1]}${trail[2] ? '' : '+'}`;
  return text;
};

// More welcome: a small toggle that shows once a line has an amount.
export const MoreWelcome: React.FC<{
  on: boolean;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Which line it's for, when there are several (read from data-index).
  index?: number;
}> = ({ on, onToggle, index }) => (
  <button
    type='button'
    className={
      on ? 'freethedream-more freethedream-more--on' : 'freethedream-more'
    }
    aria-pressed={on}
    data-index={index}
    onClick={onToggle}
  >
    <FormattedMessage
      id='freethedream.more_welcome.toggle'
      defaultMessage='+ More welcome'
    />
  </button>
);

// Which of the six a need or Actualise item is, picked as it's added
// (Tal, 2026-10-19): it is what Mycelium matches on. One tap; the pick
// stays for the next line, since a list tends to run in one category.
export const CategoryChips: React.FC<{
  value: FtdCategory;
  onChange: (category: FtdCategory) => void;
}> = ({ value, onChange }) => {
  const intl = useIntl();
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const picked = e.currentTarget.dataset.category as FtdCategory;
      onChange(picked);
    },
    [onChange],
  );
  return (
    <div
      className='freethedream-categories'
      role='radiogroup'
      aria-label={intl.formatMessage(chipMessages.label)}
    >
      {CATEGORIES.map((category) => (
        <button
          key={category}
          type='button'
          role='radio'
          aria-checked={value === category}
          className={
            value === category
              ? 'freethedream-more freethedream-more--on'
              : 'freethedream-more'
          }
          data-category={category}
          onClick={handleClick}
        >
          {intl.formatMessage(categoryMessages[category])}
        </button>
      ))}
    </div>
  );
};

const chipMessages = defineMessages({
  label: { id: 'freethedream.category.label', defaultMessage: 'Kind of thing' },
});
