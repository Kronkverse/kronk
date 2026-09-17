import { useCallback, useMemo, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { useKorner } from 'mastodon/hooks/useKorner';

import type { AggregatedEvent } from './aggregate_stream';

// Rendered in place of a run of same-key passive nudges. Clicking the
// aggregate expands to reveal each member on its own line for the
// audit-trail case (who exactly frothed my proposal, and when).
export const AggregatedEventItem: React.FC<{
  item: AggregatedEvent;
  conversationKind: 'mate' | 'krew';
}> = ({ item, conversationKind }) => {
  const [expanded, setExpanded] = useState(false);
  const sourceKorner = useKorner(item.source_korner_slug);
  const sourceLabel = sourceKorner?.name ?? item.source_korner_slug;

  const handleToggle = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const distinctActors = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const m of item.members) {
      if (seen.has(m.actor.id)) continue;
      seen.add(m.actor.id);
      names.push(m.actor.display_name || m.actor.username);
    }
    return names;
  }, [item.members]);

  const total = item.members.length;

  return (
    <div className={`nudges-event nudges-event--${item.source_korner_slug}`}>
      <span className='nudges-event__orb' aria-hidden />
      <span className='nudges-event__body'>
        <button
          type='button'
          className='nudges-event__aggregate-button'
          onClick={handleToggle}
          aria-expanded={expanded}
        >
          <span className='nudges-event__text'>
            <AggregateSummary
              conversationKind={conversationKind}
              verb={item.verb}
              total={total}
              actors={distinctActors}
              sourceLabel={sourceLabel}
            />
          </span>
          <span className='nudges-event__aggregate-caret' aria-hidden>
            {expanded ? '▾' : '▸'}
          </span>
        </button>

        {expanded && (
          <ul className='nudges-event__aggregate-list'>
            {item.members.map((m) => (
              <li key={m.id} className='nudges-event__aggregate-row'>
                <span className='nudges-event__aggregate-row-actor'>
                  {m.actor.display_name || m.actor.username}
                </span>{' '}
                <span className='nudges-event__aggregate-row-verb'>
                  {m.verb}
                </span>
                <span className='nudges-event__aggregate-row-time'>
                  <RelativeTimestamp timestamp={m.created_at} short />
                </span>
              </li>
            ))}
          </ul>
        )}

        {item.cta_route && item.cta_label && (
          <Link to={item.cta_route} className='nudges-event__cta'>
            {item.cta_label}
          </Link>
        )}
      </span>
      <span className='nudges-event__time'>
        <RelativeTimestamp timestamp={item.created_at} short />
      </span>
    </div>
  );
};

// The one-line summary. Copy diverges slightly by kind: Mate uses a
// "the other Mate did X, N times" framing; Krew names actors.
const AggregateSummary: React.FC<{
  conversationKind: 'mate' | 'krew';
  verb: string;
  total: number;
  actors: string[];
  sourceLabel: string;
}> = ({ conversationKind, verb, total, actors, sourceLabel }) => {
  if (conversationKind === 'mate') {
    return (
      <FormattedMessage
        id='nudges.aggregate.mate'
        defaultMessage='{count, plural, one {# {verb}} other {# {verb}}} in {source}'
        values={{ count: total, verb, source: sourceLabel }}
      />
    );
  }
  // Krew: list up to two names, then "and N others".
  const first = actors[0] ?? '';
  const rest = actors.length - 1;
  if (actors.length === 1) {
    return (
      <FormattedMessage
        id='nudges.aggregate.krew_one_actor'
        defaultMessage='{name} {verb} ({count}) in {source}'
        values={{ name: first, verb, count: total, source: sourceLabel }}
      />
    );
  }
  if (actors.length === 2) {
    return (
      <FormattedMessage
        id='nudges.aggregate.krew_two_actors'
        defaultMessage='{first} and {second} {verb} in {source}'
        values={{
          first,
          second: actors[1] ?? '',
          verb,
          source: sourceLabel,
        }}
      />
    );
  }
  return (
    <FormattedMessage
      id='nudges.aggregate.krew_many'
      defaultMessage='{first} and {rest, plural, one {# other} other {# others}} {verb} in {source}'
      values={{ first, rest, verb, source: sourceLabel }}
    />
  );
};
