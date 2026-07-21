import { useCallback, useMemo } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import type {
  ApiNudgeMessageJSON,
  ApiNudgeStreamItem,
} from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import EmojiPickerDropdown from 'mastodon/features/compose/containers/emoji_picker_dropdown_container';
import { useKorner } from 'mastodon/hooks/useKorner';
import { me } from 'mastodon/initial_state';
import { createAccountFromServerJSON } from 'mastodon/models/account';

const messages = defineMessages({
  addReaction: {
    id: 'nudges.reactions.add',
    defaultMessage: 'Add reaction',
  },
});

const REACTION_CAP = 3;

type ReactionHandler = (
  message: ApiNudgeMessageJSON,
  symbol: string,
) => void | Promise<void>;

type DeleteHandler = (message: ApiNudgeMessageJSON) => void | Promise<void>;
type MessageHandler = (message: ApiNudgeMessageJSON) => void | Promise<void>;

interface StreamItemProps {
  item: ApiNudgeStreamItem;
  conversationKind?: 'mate' | 'krew';
  onReact?: ReactionHandler;
  onUnreact?: ReactionHandler;
  onDelete?: DeleteHandler;
  onRetry?: MessageHandler;
  onDismissFailed?: MessageHandler;
}

// One row in the conversation stream — either a message bubble or an
// inline event. Kept in one component so the interleave stays
// obvious; a split becomes worthwhile once each side grows more
// affordances.
export const StreamItem: React.FC<StreamItemProps> = ({
  item,
  conversationKind,
  onReact,
  onUnreact,
  onDelete,
  onRetry,
  onDismissFailed,
}) => {
  if (item.kind === 'message') {
    return (
      <MessageItem
        item={item}
        conversationKind={conversationKind}
        onReact={onReact}
        onUnreact={onUnreact}
        onDelete={onDelete}
        onRetry={onRetry}
        onDismissFailed={onDismissFailed}
      />
    );
  }

  return <EventItem item={item} />;
};

interface MessageItemProps {
  item: ApiNudgeMessageJSON & { kind: 'message' };
  conversationKind?: 'mate' | 'krew';
  onReact?: ReactionHandler;
  onUnreact?: ReactionHandler;
  onDelete?: DeleteHandler;
  onRetry?: MessageHandler;
  onDismissFailed?: MessageHandler;
}

// Tombstoned messages redact to a "deleted" placeholder — brief
// non-negotiable (§Deletion model). Keeping the slot preserves the
// stream's timing so no re-flow occurs on later fetches.
const MessageItem: React.FC<MessageItemProps> = (props) => {
  if (props.item.deleted) {
    return <DeletedMessage item={props.item} />;
  }
  return <LiveMessageItem {...props} />;
};

const LiveMessageItem: React.FC<MessageItemProps> = ({
  item,
  conversationKind,
  onReact,
  onUnreact,
  onDelete,
  onRetry,
  onDismissFailed,
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

  // Krew incoming bubbles show sender name + avatar (per brief
  // §Surface 3). Mate bubbles stay bare — the pair is already known
  // from the conversation header. Suppressed for optimistic-sending
  // rows since the author stub isn't a real account yet.
  const showSender =
    conversationKind === 'krew' && !item.author_is_self && !item.sending;

  const isOptimistic = item.sending || item.failed;

  const handleRetryClick = useCallback(() => {
    void onRetry?.(item);
  }, [item, onRetry]);

  const handleDismissClick = useCallback(() => {
    void onDismissFailed?.(item);
  }, [item, onDismissFailed]);

  return (
    <div
      className={`nudges-msg ${
        item.author_is_self ? 'nudges-msg--out' : 'nudges-msg--in'
      } ${item.sending ? 'nudges-msg--sending' : ''} ${
        item.failed ? 'nudges-msg--failed' : ''
      }`}
    >
      {showSender && (
        <div className='nudges-msg__sender'>
          <SenderAvatar author={item.author} />
          <span className='nudges-msg__sender-name'>
            {item.author.display_name || item.author.username}
          </span>
        </div>
      )}
      <div className='nudges-msg__bubble'>
        {item.media.length > 0 && <MessageMediaGrid media={item.media} />}
        {item.body && <span className='nudges-msg__body'>{item.body}</span>}
      </div>

      {!isOptimistic && (grouped.length > 0 || onReact) && (
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
          {onReact && canAdd && (
            <AddReactionPicker
              onPick={handleToggle}
              label={intl.formatMessage(messages.addReaction)}
            />
          )}
        </div>
      )}

      <span className='nudges-msg__time'>
        {item.sending ? (
          <FormattedMessage id='nudges.sending' defaultMessage='Sending…' />
        ) : item.failed ? (
          <FailedControls
            onRetry={handleRetryClick}
            onDismiss={handleDismissClick}
          />
        ) : (
          <RelativeTimestamp timestamp={item.created_at} short />
        )}
        {!isOptimistic && item.author_is_self && onDelete && (
          <DeleteButton item={item} onDelete={onDelete} />
        )}
      </span>
    </div>
  );
};

const FailedControls: React.FC<{
  onRetry: () => void;
  onDismiss: () => void;
}> = ({ onRetry, onDismiss }) => (
  <span className='nudges-msg__failed-controls'>
    <span className='nudges-msg__failed-label'>
      <FormattedMessage id='nudges.send_failed' defaultMessage='Send failed' />
    </span>
    <button
      type='button'
      className='nudges-msg__failed-action'
      onClick={onRetry}
    >
      <FormattedMessage id='nudges.retry' defaultMessage='Retry' />
    </button>
    <button
      type='button'
      className='nudges-msg__failed-action nudges-msg__failed-action--dismiss'
      onClick={onDismiss}
      aria-label='Dismiss'
    >
      ×
    </button>
  </span>
);

const DeletedMessage: React.FC<{ item: ApiNudgeMessageJSON }> = ({ item }) => (
  <div
    className={`nudges-msg nudges-msg--deleted ${
      item.author_is_self ? 'nudges-msg--out' : 'nudges-msg--in'
    }`}
  >
    <div className='nudges-msg__bubble nudges-msg__bubble--deleted'>
      <FormattedMessage
        id='nudges.message_deleted'
        defaultMessage='Message deleted'
      />
    </div>
    <span className='nudges-msg__time'>
      <RelativeTimestamp timestamp={item.created_at} short />
    </span>
  </div>
);

const DeleteButton: React.FC<{
  item: ApiNudgeMessageJSON;
  onDelete: DeleteHandler;
}> = ({ item, onDelete }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    if (
      window.confirm(
        intl.formatMessage({
          id: 'nudges.confirm_delete',
          defaultMessage: 'Delete this message?',
        }),
      )
    ) {
      void onDelete(item);
    }
  }, [item, onDelete, intl]);
  return (
    <button
      type='button'
      className='nudges-msg__delete'
      onClick={handleClick}
      aria-label={intl.formatMessage({
        id: 'nudges.delete',
        defaultMessage: 'Delete',
      })}
      title={intl.formatMessage({
        id: 'nudges.delete',
        defaultMessage: 'Delete',
      })}
    >
      ×
    </button>
  );
};

const SenderAvatar: React.FC<{
  author: ApiNudgeMessageJSON['author'];
}> = ({ author }) => {
  const account = createAccountFromServerJSON(author);
  return <Avatar account={account} size={20} />;
};

const MessageMediaGrid: React.FC<{
  media: ApiNudgeMessageJSON['media'];
}> = ({ media }) => {
  const count = Math.min(media.length, 4);
  return (
    <div className={`nudges-msg__media-grid nudges-msg__media-grid--${count}`}>
      {media.map((m) => (
        <MessageMediaTile key={m.id} media={m} />
      ))}
    </div>
  );
};

const MessageMediaTile: React.FC<{
  media: ApiNudgeMessageJSON['media'][number];
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

interface AddReactionPickerProps {
  label: string;
  onPick: (symbol: string, mine: boolean) => void;
}

// Wraps Mastodon's Compose EmojiPickerDropdown (same picker Compose
// uses) so the full emoji palette + search + recents come along.
// EmojiPickerDropdown owns its trigger button + positioning; we
// just hand it the "+" icon and translate its onPickEmoji callback
// into our reaction-toggle contract.
const AddReactionPicker: React.FC<AddReactionPickerProps> = ({
  label,
  onPick,
}) => {
  const handlePick = useCallback(
    (emoji: { native?: string; shortcode?: string }) => {
      // Mastodon's picker returns Unicode via `native` and custom
      // emojis via `shortcode`; we only accept the Unicode ones here
      // — custom-emoji reactions live in Announcements-land, not
      // here (yet).
      const symbol = emoji.native?.replaceAll(':', '');
      if (!symbol) return;
      onPick(symbol, false);
    },
    [onPick],
  );

  return (
    <span className='nudges-msg__react-add' title={label}>
      <EmojiPickerDropdown
        onPickEmoji={handlePick}
        button={<Icon id='plus' icon={AddIcon} />}
      />
    </span>
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
  const sourceKorner = useKorner(item.source_korner_slug);

  if (item.verb.startsWith(MILESTONE_PREFIX)) {
    return <MilestonePin item={item} />;
  }

  const actor = createAccountFromServerJSON(item.actor);
  const actorName = actor.display_name || actor.username;
  const sourceLabel = sourceKorner?.name ?? item.source_korner_slug;

  return (
    <div className={`nudges-event nudges-event--${item.source_korner_slug}`}>
      <span className='nudges-event__orb' aria-hidden />
      <span className='nudges-event__body'>
        <span className='nudges-event__avatar'>
          <Avatar account={actor} size={24} />
        </span>
        <span className='nudges-event__text'>
          <strong>{actorName}</strong> {item.verb}{' '}
          <span className='nudges-event__source'>in {sourceLabel}</span>
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
