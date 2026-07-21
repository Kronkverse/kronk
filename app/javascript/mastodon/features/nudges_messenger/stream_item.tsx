import { useCallback, useMemo } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import { Link } from 'react-router-dom';

import type {
  ApiNudgeMessageJSON,
  ApiNudgeStreamItem,
} from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { me } from 'mastodon/initial_state';
import { createAccountFromServerJSON } from 'mastodon/models/account';

const messages = defineMessages({
  addReaction: {
    id: 'nudges.reactions.add',
    defaultMessage: 'Add reaction',
  },
});

// Small preset. Custom-picker lands later; for a v1 shell three
// common expressions cover most reactions and stay well under the
// server-enforced 3-DISTINCT cap.
const PRESETS = ['👍', '❤️', '🎉'];

const REACTION_CAP = 3;

type ReactionHandler = (
  message: ApiNudgeMessageJSON,
  symbol: string,
) => void | Promise<void>;

interface StreamItemProps {
  item: ApiNudgeStreamItem;
  onReact?: ReactionHandler;
  onUnreact?: ReactionHandler;
}

// One row in the conversation stream — either a message bubble or an
// inline event. Kept in one component so the interleave stays
// obvious; a split becomes worthwhile once each side grows more
// affordances.
export const StreamItem: React.FC<StreamItemProps> = ({
  item,
  onReact,
  onUnreact,
}) => {
  if (item.kind === 'message') {
    return <MessageItem item={item} onReact={onReact} onUnreact={onUnreact} />;
  }

  return <EventItem item={item} />;
};

interface MessageItemProps {
  item: ApiNudgeMessageJSON & { kind: 'message' };
  onReact?: ReactionHandler;
  onUnreact?: ReactionHandler;
}

const MessageItem: React.FC<MessageItemProps> = ({
  item,
  onReact,
  onUnreact,
}) => {
  const intl = useIntl();

  // Group reactions by symbol; count and whether the current user is
  // in the list.
  const grouped = useMemo(() => {
    const bySymbol = new Map<string, { count: number; mine: boolean }>();
    for (const r of item.reactions) {
      const entry = bySymbol.get(r.symbol) ?? { count: 0, mine: false };
      entry.count += 1;
      if (me && String(r.account_id) === me) entry.mine = true;
      bySymbol.set(r.symbol, entry);
    }
    return Array.from(bySymbol, ([symbol, meta]) => ({ symbol, ...meta }));
  }, [item.reactions]);

  const distinctCount = grouped.length;
  const canAdd = distinctCount < REACTION_CAP;

  const handleToggle = useCallback(
    (symbol: string, mine: boolean) => {
      if (mine) {
        void onUnreact?.(item, symbol);
      } else {
        // Add-when-cap-full is allowed only if the symbol already exists
        // (server enforces this too).
        const exists = grouped.some((g) => g.symbol === symbol);
        if (!canAdd && !exists) return;
        void onReact?.(item, symbol);
      }
    },
    [item, onReact, onUnreact, grouped, canAdd],
  );

  return (
    <div
      className={`nudges-msg ${
        item.author_is_self ? 'nudges-msg--out' : 'nudges-msg--in'
      }`}
    >
      <div className='nudges-msg__bubble'>
        {item.media && <MessageMedia media={item.media} />}
        {item.body && <span className='nudges-msg__body'>{item.body}</span>}
      </div>

      {(grouped.length > 0 || onReact) && (
        <div className='nudges-msg__reactions'>
          {grouped.map((r) => (
            <ReactionChip
              key={r.symbol}
              symbol={r.symbol}
              count={r.count}
              mine={r.mine}
              onToggle={handleToggle}
            />
          ))}
          {onReact && (
            <div className='nudges-msg__react-picker' role='group'>
              {PRESETS.filter(
                (symbol) => !grouped.some((g) => g.symbol === symbol) && canAdd,
              ).map((symbol) => (
                <AddReactionButton
                  key={symbol}
                  symbol={symbol}
                  label={intl.formatMessage(messages.addReaction)}
                  onAdd={handleToggle}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <span className='nudges-msg__time'>
        <RelativeTimestamp timestamp={item.created_at} short />
      </span>
    </div>
  );
};

const MessageMedia: React.FC<{
  media: NonNullable<ApiNudgeMessageJSON['media']>;
}> = ({ media }) => {
  if (media.type === 'video' || media.type === 'gifv') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        className='nudges-msg__media'
        src={media.url ?? undefined}
        poster={media.preview_url ?? undefined}
        controls
        playsInline
      />
    );
  }

  return (
    <img
      className='nudges-msg__media'
      src={media.preview_url ?? media.url ?? undefined}
      alt={media.description ?? ''}
    />
  );
};

interface AddReactionButtonProps {
  symbol: string;
  label: string;
  onAdd: (symbol: string, mine: boolean) => void;
}

const AddReactionButton: React.FC<AddReactionButtonProps> = ({
  symbol,
  label,
  onAdd,
}) => {
  const handleClick = useCallback(() => {
    onAdd(symbol, false);
  }, [symbol, onAdd]);

  return (
    <button
      type='button'
      className='nudges-msg__react-add'
      aria-label={label}
      onClick={handleClick}
    >
      {symbol}
    </button>
  );
};

interface ReactionChipProps {
  symbol: string;
  count: number;
  mine: boolean;
  onToggle: (symbol: string, mine: boolean) => void;
}

const ReactionChip: React.FC<ReactionChipProps> = ({
  symbol,
  count,
  mine,
  onToggle,
}) => {
  const handleClick = useCallback(() => {
    onToggle(symbol, mine);
  }, [symbol, mine, onToggle]);

  return (
    <button
      type='button'
      className={`nudges-msg__reaction ${mine ? 'nudges-msg__reaction--mine' : ''}`}
      onClick={handleClick}
    >
      <span className='nudges-msg__reaction-symbol' aria-hidden>
        {symbol}
      </span>
      <span className='nudges-msg__reaction-count'>{count}</span>
    </button>
  );
};

// Milestone events carry verb `milestone_<threshold>` and render as a
// centered pin distinct from ordinary korner events. Threshold is
// parsed off the verb; the source korner slug on these events is
// `nudges` itself.
const MILESTONE_PREFIX = 'milestone_';

const EventItem: React.FC<{
  item: Extract<ApiNudgeStreamItem, { kind: 'event' }>;
}> = ({ item }) => {
  if (item.verb.startsWith(MILESTONE_PREFIX)) {
    return <MilestonePin item={item} />;
  }

  const actor = createAccountFromServerJSON(item.actor);
  const actorName = actor.display_name || actor.username;

  return (
    <div className={`nudges-event nudges-event--${item.source_korner_slug}`}>
      <span className='nudges-event__orb' aria-hidden />
      <span className='nudges-event__body'>
        <span className='nudges-event__avatar'>
          <Avatar account={actor} size={24} />
        </span>
        <span className='nudges-event__text'>
          <strong>{actorName}</strong> {item.verb}{' '}
          <span className='nudges-event__source'>
            in {item.source_korner_slug}
          </span>
        </span>
        {item.interaction === 'interactive' &&
          item.cta_label &&
          item.cta_route && (
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

const MilestonePin: React.FC<{
  item: Extract<ApiNudgeStreamItem, { kind: 'event' }>;
}> = ({ item }) => {
  const threshold = item.verb.slice(MILESTONE_PREFIX.length);

  return (
    <div className='nudges-milestone' role='note'>
      <span className='nudges-milestone__marker' aria-hidden>
        ✦
      </span>
      <span className='nudges-milestone__text'>
        <FormattedMessage
          id='nudges.milestone'
          defaultMessage='{count, number} messages together'
          values={{ count: Number(threshold) }}
        />
      </span>
      <span className='nudges-milestone__time'>
        <RelativeTimestamp timestamp={item.created_at} short />
      </span>
    </div>
  );
};
