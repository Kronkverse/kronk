import { useCallback, useMemo } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import classNames from 'classnames';
import { Link } from 'react-router-dom';

import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import type {
  ApiNudgeKrewReadPointer,
  ApiNudgeMessageJSON,
  ApiNudgeStreamItem,
} from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { IconButton } from 'mastodon/components/icon_button';
import {
  KronkLinkCards,
  kronkPathsInText,
} from 'mastodon/components/kronk_link_card';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import EmojiPickerDropdown from 'mastodon/features/compose/containers/emoji_picker_dropdown_container';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';
import { useKorner } from 'mastodon/hooks/useKorner';
import { me } from 'mastodon/initial_state';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { LinkifiedBody } from './linkified_body';
import { MessageMediaGrid } from './message_media';

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
  otherLastReadMessageId?: string | null;
  // Krew-only: per-member last-read pointers + total member count.
  // Used to render an M-of-N read receipt on self-authored bubbles.
  krewReadPointers?: ApiNudgeKrewReadPointer[];
  krewMemberCount?: number;
  onReact?: ReactionHandler;
  onUnreact?: ReactionHandler;
  onDelete?: DeleteHandler;
  onRetry?: MessageHandler;
  onDismissFailed?: MessageHandler;
  // Where the message sits in a run of messages from the same person
  // (consecutive, a few minutes apart). The name and avatar show once, at
  // the top of a run, and the bubbles in a run sit close together.
  runStart?: boolean;
  runEnd?: boolean;
  // Its reaction and delete controls are showing: a tap on the bubble on a
  // phone, where there is no hover. One message at a time.
  active?: boolean;
  onActivate?: (id: string | null) => void;
}

// One row in the conversation stream — either a message bubble or an
// inline event. Kept in one component so the interleave stays
// obvious; a split becomes worthwhile once each side grows more
// affordances.
export const StreamItem: React.FC<StreamItemProps> = ({
  item,
  conversationKind,
  otherLastReadMessageId,
  krewReadPointers,
  krewMemberCount,
  onReact,
  onUnreact,
  onDelete,
  onRetry,
  onDismissFailed,
  runStart = true,
  runEnd = true,
  active = false,
  onActivate,
}) => {
  if (item.kind === 'message') {
    return (
      <MessageItem
        item={item}
        conversationKind={conversationKind}
        otherLastReadMessageId={otherLastReadMessageId}
        krewReadPointers={krewReadPointers}
        krewMemberCount={krewMemberCount}
        onReact={onReact}
        onUnreact={onUnreact}
        onDelete={onDelete}
        onRetry={onRetry}
        onDismissFailed={onDismissFailed}
        runStart={runStart}
        runEnd={runEnd}
        active={active}
        onActivate={onActivate}
      />
    );
  }

  return <EventItem item={item} />;
};

interface MessageItemProps {
  item: ApiNudgeMessageJSON & { kind: 'message' };
  conversationKind?: 'mate' | 'krew';
  otherLastReadMessageId?: string | null;
  krewReadPointers?: ApiNudgeKrewReadPointer[];
  krewMemberCount?: number;
  onReact?: ReactionHandler;
  onUnreact?: ReactionHandler;
  onDelete?: DeleteHandler;
  onRetry?: MessageHandler;
  onDismissFailed?: MessageHandler;
  runStart: boolean;
  runEnd: boolean;
  active: boolean;
  onActivate?: (id: string | null) => void;
}

// Tombstoned messages redact to a "deleted" placeholder — brief
// non-negotiable (§Deletion model). Keeping the slot preserves the
// stream's timing so no re-flow occurs on later fetches.
const MessageItem: React.FC<MessageItemProps> = (props) => {
  if (props.item.deleted) {
    return (
      <DeletedMessage
        item={props.item}
        withSender={
          props.conversationKind === 'krew' && !props.item.author_is_self
        }
        runStart={props.runStart}
        runEnd={props.runEnd}
      />
    );
  }
  return <LiveMessageItem {...props} />;
};

const LiveMessageItem: React.FC<MessageItemProps> = ({
  item,
  conversationKind,
  otherLastReadMessageId,
  krewReadPointers,
  krewMemberCount,
  onReact,
  onUnreact,
  onDelete,
  onRetry,
  onDismissFailed,
  runStart,
  runEnd,
  active,
  onActivate,
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

  // In a Krew chat, other people's messages carry who sent them: the
  // avatar beside the bubble and the name above it, once per run. Mate
  // chats stay bare, since the header already says who it is. Not for
  // optimistic-sending rows, whose author stub isn't a real account yet.
  const showSender =
    conversationKind === 'krew' && !item.author_is_self && !item.sending;

  const isOptimistic = item.sending || item.failed;

  // Mate "seen" indicator: self-authored, other party's read pointer
  // has advanced past this message. BigInt for the snowflake compare.
  const seenByOther =
    item.author_is_self &&
    conversationKind === 'mate' &&
    !isOptimistic &&
    !!otherLastReadMessageId &&
    !item.id.startsWith('tmp-') &&
    BigInt(item.id) <= BigInt(otherLastReadMessageId);

  // Krew M-of-N read receipt: self-authored, count of members whose
  // read pointer has advanced past this message id. Denominator is
  // (member_count - 1) since the sender doesn't count.
  const krewReadCount =
    item.author_is_self &&
    conversationKind === 'krew' &&
    !isOptimistic &&
    !item.id.startsWith('tmp-') &&
    krewReadPointers
      ? krewReadPointers.filter(
          (p) => BigInt(p.last_read_message_id) >= BigInt(item.id),
        ).length
      : 0;
  const krewReadTotal = krewMemberCount ? Math.max(0, krewMemberCount - 1) : 0;
  const showKrewReadReceipt =
    conversationKind === 'krew' &&
    item.author_is_self &&
    !isOptimistic &&
    krewReadTotal > 0;

  const handleRetryClick = useCallback(() => {
    void onRetry?.(item);
  }, [item, onRetry]);

  const handleDismissClick = useCallback(() => {
    void onDismissFailed?.(item);
  }, [item, onDismissFailed]);

  const canReact = !isOptimistic && !!onReact && canAdd;
  const canDelete = !isOptimistic && item.author_is_self && !!onDelete;

  // A tap on the bubble shows its controls beside it (a phone has no
  // hover); a second tap, or a tap on another message, puts them away. A
  // tap on something in the bubble that does its own thing (a link, a
  // video, a card) is left to it.
  const handleBubbleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onActivate || isOptimistic) return;
      const target = e.target as HTMLElement;
      if (target.closest('a, button, video, audio, input, textarea')) return;
      onActivate(active ? null : item.id);
    },
    [onActivate, isOptimistic, active, item.id],
  );

  return (
    <div
      className={classNames(
        'nudges-msg',
        item.author_is_self ? 'nudges-msg--out' : 'nudges-msg--in',
        {
          'nudges-msg--sending': item.sending,
          'nudges-msg--failed': item.failed,
          'nudges-msg--run-start': runStart,
          'nudges-msg--run-end': runEnd,
          'nudges-msg--active': active,
          'nudges-msg--reacted': grouped.length > 0,
          'nudges-msg--with-sender': showSender,
        },
      )}
    >
      {showSender && (
        <span className='nudges-msg__avatar'>
          {runStart && <SenderAvatar author={item.author} />}
        </span>
      )}
      <div className='nudges-msg__main'>
        {showSender && runStart && (
          <span className='nudges-msg__sender-name'>
            {item.author.display_name || item.author.username}
          </span>
        )}
        <div className='nudges-msg__line'>
          {/* The keyboard path to the controls is focus: they show when
              tabbed to. The tap is for touch screens. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className='nudges-msg__bubble' onClick={handleBubbleClick}>
            {item.media.length > 0 && <MessageMediaGrid media={item.media} />}
            {item.body && (
              <span className='nudges-msg__body'>
                <LinkifiedBody body={item.body} />
              </span>
            )}
            {/* Links to things on Kronk: their cards, as this viewer sees them. */}
            {item.body && (
              <KronkLinkCards
                paths={kronkPathsInText(item.body)}
                className='nudges-msg__links'
              />
            )}
            <span className='nudges-msg__meta'>
              {item.sending ? (
                <FormattedMessage
                  id='nudges.sending'
                  defaultMessage='Sending…'
                />
              ) : (
                <RelativeTimestamp timestamp={item.created_at} short />
              )}
              {seenByOther && (
                <span
                  className='nudges-msg__seen'
                  aria-label='Seen'
                  title='Seen'
                >
                  <FormattedMessage id='nudges.seen' defaultMessage='Seen' />
                </span>
              )}
              {showKrewReadReceipt && (
                <span
                  className='nudges-msg__seen'
                  aria-label={`Read by ${krewReadCount} of ${krewReadTotal}`}
                  title={`Read by ${krewReadCount} of ${krewReadTotal}`}
                >
                  <FormattedMessage
                    id='nudges.krew_seen'
                    defaultMessage='Read {count}/{total}'
                    values={{ count: krewReadCount, total: krewReadTotal }}
                  />
                </span>
              )}
            </span>

            {/* Reactions sit on the bubble's bottom edge. */}
            {!isOptimistic && grouped.length > 0 && (
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
              </div>
            )}
          </div>

          {/* Beside the bubble, as in Signal: react, and take back your own.
              Shown on hover, on focus, or after a tap on the bubble. */}
          {(canReact || canDelete) && (
            <div className='nudges-msg__actions'>
              {canReact && (
                <AddReactionPicker
                  onPick={handleToggle}
                  label={intl.formatMessage(messages.addReaction)}
                />
              )}
              {canDelete && <DeleteButton item={item} onDelete={onDelete} />}
            </div>
          )}
        </div>

        {item.failed && (
          <FailedControls
            onRetry={handleRetryClick}
            onDismiss={handleDismissClick}
          />
        )}
      </div>
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

const DeletedMessage: React.FC<{
  item: ApiNudgeMessageJSON;
  withSender: boolean;
  runStart: boolean;
  runEnd: boolean;
}> = ({ item, withSender, runStart, runEnd }) => (
  <div
    className={classNames(
      'nudges-msg',
      'nudges-msg--deleted',
      item.author_is_self ? 'nudges-msg--out' : 'nudges-msg--in',
      {
        'nudges-msg--run-start': runStart,
        'nudges-msg--run-end': runEnd,
        'nudges-msg--with-sender': withSender,
      },
    )}
  >
    {withSender && (
      <span className='nudges-msg__avatar'>
        {runStart && <SenderAvatar author={item.author} />}
      </span>
    )}
    <div className='nudges-msg__main'>
      <div className='nudges-msg__line'>
        <div className='nudges-msg__bubble nudges-msg__bubble--deleted'>
          <FormattedMessage
            id='nudges.message_deleted'
            defaultMessage='Message deleted'
          />
          <span className='nudges-msg__meta'>
            <RelativeTimestamp timestamp={item.created_at} short />
          </span>
        </div>
      </div>
    </div>
  </div>
);

const DeleteButton: React.FC<{
  item: ApiNudgeMessageJSON;
  onDelete: DeleteHandler;
}> = ({ item, onDelete }) => {
  const intl = useIntl();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const handleClick = useCallback(() => {
    confirmThen(
      intl.formatMessage({
        id: 'nudges.confirm_delete',
        defaultMessage: 'Delete this message?',
      }),
      'delete',
      () => {
        void onDelete(item);
      },
    );
  }, [item, onDelete, intl, confirmThen]);
  return (
    <>
      {confirmDialog}
      <IconButton
        className='nudges-msg__action nudges-msg__delete'
        icon='delete'
        iconComponent={DeleteIcon}
        title={intl.formatMessage({
          id: 'nudges.delete',
          defaultMessage: 'Delete',
        })}
        onClick={handleClick}
      />
    </>
  );
};

const SenderAvatar: React.FC<{
  author: ApiNudgeMessageJSON['author'];
}> = ({ author }) => {
  const account = createAccountFromServerJSON(author);
  return <Avatar account={account} size={28} />;
};

interface AddReactionPickerProps {
  label: string;
  onPick: (symbol: string, mine: boolean) => void;
}

// Wraps Mastodon's Compose EmojiPickerDropdown (same picker Compose
// uses) so the full emoji palette + search + recents come along.
// EmojiPickerDropdown owns its trigger button (the smiley) and its
// positioning; we translate its onPickEmoji callback into our
// reaction-toggle contract.
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
    <span className='nudges-msg__action nudges-msg__react-add' title={label}>
      <EmojiPickerDropdown onPickEmoji={handlePick} />
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
          {item.verb === 'krew_invite' ? (
            // A Krew invite reads as a directed sentence; the Krew's name rides
            // on the CTA button (cta_label), so no trailing "in {source}".
            <FormattedMessage
              id='nudges.krew_invite'
              defaultMessage='{name} invited you to join'
              values={{ name: <strong>{actorName}</strong> }}
            />
          ) : (
            <>
              <strong>{actorName}</strong> {item.verb}{' '}
              <span className='nudges-event__source'>in {sourceLabel}</span>
            </>
          )}
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
