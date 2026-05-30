import { useEffect, useState, useCallback, useRef } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import PartnerExchangeActiveIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import {
  decrementNudgeCount,
  setUnreadNudgeCount,
} from 'mastodon/actions/notification_groups';
import {
  apiNudgeAccount,
  apiGetNudgePartners,
  apiGetNudgeThread,
} from 'mastodon/api/accounts';
import type {
  ApiNudgePartner,
  ApiNudgeSuggestion,
  ApiNudgeThreadMessage,
} from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Button } from 'mastodon/components/button';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { DisplayName } from 'mastodon/components/display_name';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import type {
  NudgeReactionEmoji,
  NudgeReactions,
  NotificationGroupNudge,
} from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const REACTION_EMOJI: NudgeReactionEmoji[] = ['❤️', '😂', '🙌', '🔥', '😢'];

const messages = defineMessages({
  title: { id: 'nudges.title', defaultMessage: 'Nudges' },
  back: { id: 'nudges.thread.back', defaultMessage: 'Back to inbox' },
});

// ── Reaction button (reusable in thread bubbles) ───────────────────────────────

const ThreadReactionButton: React.FC<{
  emoji: NudgeReactionEmoji;
  count: number;
  me: boolean;
  onReact: (emoji: NudgeReactionEmoji) => void;
}> = ({ emoji, count, me, onReact }) => {
  const handleClick = useCallback(() => {
    onReact(emoji);
  }, [emoji, onReact]);
  return (
    <button
      type='button'
      className={`nudge-bubble__reaction${me ? ' nudge-bubble__reaction--active' : ''}`}
      onClick={handleClick}
    >
      <span>{emoji}</span>
      {count > 0 && (
        <span className='nudge-bubble__reaction-count'>{count}</span>
      )}
    </button>
  );
};

const ThreadReactionBar: React.FC<{
  notificationId: string;
  reactions: NudgeReactions;
}> = ({ notificationId, reactions }) => {
  const [local, setLocal] = useState<NudgeReactions>(reactions);

  const handleReact = useCallback(
    (emoji: NudgeReactionEmoji) => {
      const already = local[emoji].me;
      void (async () => {
        const csrf = document.querySelector<HTMLMetaElement>(
          'meta[name="csrf-token"]',
        );
        const res = await fetch(
          `/api/v1/notifications/${notificationId}/nudge_react`,
          {
            method: already ? 'DELETE' : 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrf?.content ?? '',
            },
            credentials: 'same-origin',
            body: already ? undefined : JSON.stringify({ emoji }),
          },
        );
        if (res.ok) {
          const updated = (await res.json()) as NudgeReactions;
          setLocal(updated);
        }
      })();
    },
    [notificationId, local],
  );

  return (
    <div className='nudge-bubble__reactions'>
      {REACTION_EMOJI.map((emoji) => {
        const { count, me } = local[emoji];
        return (
          <ThreadReactionButton
            key={emoji}
            emoji={emoji}
            count={count}
            me={me}
            onReact={handleReact}
          />
        );
      })}
    </div>
  );
};

// ── Single message bubble ──────────────────────────────────────────────────────

const NudgeBubble: React.FC<{
  message: ApiNudgeThreadMessage;
  partnerAccountId?: string;
}> = ({ message, partnerAccountId }) => {
  const account = useAppSelector((state) =>
    partnerAccountId ? state.accounts.get(partnerAccountId) : undefined,
  );
  const [revealed, setRevealed] = useState(false);
  const isSent = message.direction === 'sent';
  const hasContent = !!(message.body ?? message.media_url ?? message.voice_url);

  const handleReveal = useCallback(() => {
    setRevealed(true);
  }, []);

  const revealLabel = (() => {
    if (message.voice_url && !message.body && !message.media_url) {
      return (
        <FormattedMessage
          id='notification.nudge.listen'
          defaultMessage='Listen'
        />
      );
    }
    if (message.media_url && !message.body && !message.voice_url) {
      return (
        <FormattedMessage id='notification.nudge.view' defaultMessage='View' />
      );
    }
    return (
      <FormattedMessage
        id='notification.nudge.read'
        defaultMessage='Read message'
      />
    );
  })();

  const reactions = message.reactions as NudgeReactions;

  return (
    <div
      className={`nudge-bubble nudge-bubble--${isSent ? 'sent' : 'received'}`}
    >
      {!isSent && account && (
        <Link
          to={`/@${account.acct}`}
          className='nudge-bubble__avatar'
          tabIndex={-1}
        >
          <Avatar account={account} size={28} />
        </Link>
      )}
      <div className='nudge-bubble__content'>
        <div className='nudge-bubble__body'>
          {!hasContent && (
            <span className='nudge-bubble__plain'>
              {isSent ? (
                <FormattedMessage
                  id='nudges.thread.plain_sent'
                  defaultMessage='Nudged'
                />
              ) : (
                <FormattedMessage
                  id='nudges.thread.plain_received'
                  defaultMessage='Nudged you'
                />
              )}
            </span>
          )}
          {hasContent && !isSent && !revealed && (
            <button
              type='button'
              className='nudge-bubble__reveal-btn'
              onClick={handleReveal}
            >
              {revealLabel}
            </button>
          )}
          {hasContent && (isSent || revealed) && (
            <>
              {message.body && (
                <p className='nudge-bubble__text'>{message.body}</p>
              )}
              {message.media_url && (
                <img
                  src={message.media_url}
                  alt=''
                  className='nudge-bubble__media'
                />
              )}
              {message.voice_url && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio
                  controls
                  src={message.voice_url}
                  className='nudge-bubble__voice'
                />
              )}
            </>
          )}
        </div>
        <time className='nudge-bubble__time'>
          <RelativeTimestamp timestamp={message.created_at} />
        </time>
        <ThreadReactionBar
          notificationId={message.notification_id}
          reactions={reactions}
        />
      </div>
    </div>
  );
};

// ── Thread view ────────────────────────────────────────────────────────────────

const NudgeThreadView: React.FC<{
  partnerId: string;
  onBack: () => void;
  onNudgeSent: () => void;
}> = ({ partnerId, onBack, onNudgeSent }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) => state.accounts.get(partnerId));
  const [threadMessages, setThreadMessages] = useState<ApiNudgeThreadMessage[]>(
    [],
  );
  const [canNudgeBack, setCanNudgeBack] = useState(false);
  const [streak, setStreak] = useState(0);
  const [threadLoading, setThreadLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    setThreadLoading(true);
    try {
      const data = await apiGetNudgeThread(partnerId);
      setThreadMessages(data.messages);
      setCanNudgeBack(data.can_nudge_back);
      setStreak(data.streak);
    } finally {
      setThreadLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!threadLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [threadLoading]);

  const handleJustNudge = useCallback(() => {
    if (sending) return;
    setSending(true);
    void (async () => {
      try {
        await apiNudgeAccount(partnerId);
        dispatch(decrementNudgeCount());
        onNudgeSent();
        await loadThread();
      } catch {
        // 422 = can't nudge yet — silently ignore
      } finally {
        setSending(false);
      }
    })();
  }, [partnerId, sending, dispatch, onNudgeSent, loadThread]);

  const handleAddMessage = useCallback(() => {
    const lastReceived = [...threadMessages]
      .reverse()
      .find((m) => m.direction === 'received');
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: partnerId,
          inReplyToNotificationId: lastReceived?.notification_id,
          onSent: (newStreak: number) => {
            setStreak(newStreak);
            dispatch(decrementNudgeCount());
            onNudgeSent();
            void loadThread();
          },
        },
      }),
    );
  }, [partnerId, threadMessages, dispatch, onNudgeSent, loadThread]);

  if (!account) return null;

  return (
    <div className='nudge-thread'>
      <div className='nudge-thread__header'>
        <button
          type='button'
          className='nudge-thread__back'
          onClick={onBack}
          aria-label={intl.formatMessage(messages.back)}
        >
          <Icon icon={ArrowBackIcon} id='arrow_back' />
        </button>
        <Link to={`/@${account.acct}`} className='nudge-thread__header-avatar'>
          <Avatar account={account} size={32} />
        </Link>
        <span className='nudge-thread__header-name'>
          <DisplayName account={account} />
        </span>
        {streak > 0 && (
          <span className='nudge-thread__streak-badge'>
            <FormattedMessage
              id='nudges.thread.streak'
              defaultMessage='{count, plural, one {# nudge} other {# nudges}}'
              values={{ count: streak }}
            />
          </span>
        )}
      </div>

      <div className='nudge-thread__messages scrollable'>
        {threadLoading && (
          <div className='loading-indicator'>
            <div className='loading-indicator__figure' />
          </div>
        )}
        {!threadLoading &&
          threadMessages.map((msg) => (
            <NudgeBubble
              key={msg.notification_id}
              message={msg}
              partnerAccountId={
                msg.direction === 'received' ? partnerId : undefined
              }
            />
          ))}
        <div ref={bottomRef} />
      </div>

      <div className='nudge-thread__compose'>
        {canNudgeBack ? (
          <>
            <Button compact disabled={sending} onClick={handleJustNudge}>
              <FormattedMessage
                id='nudge_compose.just_nudge'
                defaultMessage='Just nudge'
              />
            </Button>
            <button
              type='button'
              className='nudge-thread__add-message-btn'
              onClick={handleAddMessage}
            >
              <FormattedMessage
                id='nudge_compose.add_message'
                defaultMessage='Add a message'
              />
            </button>
          </>
        ) : (
          <span className='nudge-thread__waiting'>
            <FormattedMessage
              id='nudges.thread.waiting'
              defaultMessage='Waiting for their reply…'
            />
          </span>
        )}
      </div>
    </div>
  );
};

// ── Inbox conversation row ─────────────────────────────────────────────────────

const NudgeConversationRow: React.FC<{
  partner: ApiNudgePartner;
  onOpen: (accountId: string) => void;
}> = ({ partner, onOpen }) => {
  const account = useAppSelector((state) =>
    state.accounts.get(partner.account_id),
  );
  const handleClick = useCallback(() => {
    onOpen(partner.account_id);
  }, [partner.account_id, onOpen]);

  if (!account) return null;

  const { last_message: lastMsg } = partner;
  let preview: React.ReactNode;
  if (lastMsg.type === 'image') {
    preview = (
      <FormattedMessage id='nudges.preview.image' defaultMessage='Image' />
    );
  } else if (lastMsg.type === 'voice') {
    preview = (
      <FormattedMessage
        id='nudges.preview.voice'
        defaultMessage='Voice message'
      />
    );
  } else if (lastMsg.type === 'text' && lastMsg.body) {
    preview = lastMsg.body;
  } else {
    preview = (
      <FormattedMessage id='nudges.preview.plain' defaultMessage='Nudge' />
    );
  }

  return (
    <button
      type='button'
      className={`nudge-conversation-row${partner.can_nudge_back ? ' nudge-conversation-row--unread' : ''}`}
      onClick={handleClick}
    >
      <div className='nudge-conversation-row__avatar-wrap'>
        <Avatar account={account} size={44} />
        {partner.can_nudge_back && (
          <span className='nudge-conversation-row__unread-dot' />
        )}
      </div>
      <div className='nudge-conversation-row__body'>
        <div className='nudge-conversation-row__top'>
          <span className='nudge-conversation-row__name'>
            <DisplayName account={account} />
          </span>
          {partner.last_nudge_at && (
            <span className='nudge-conversation-row__time'>
              <RelativeTimestamp timestamp={partner.last_nudge_at} />
            </span>
          )}
        </div>
        <div className='nudge-conversation-row__preview'>{preview}</div>
      </div>
    </button>
  );
};

// ── Suggestion item ────────────────────────────────────────────────────────────

const NudgeSuggestionItem: React.FC<{ suggestion: ApiNudgeSuggestion }> = ({
  suggestion,
}) => {
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) =>
    state.accounts.get(suggestion.account_id),
  );
  const [nudged, setNudged] = useState(false);

  const handleNudge = useCallback(() => {
    if (nudged) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: suggestion.account_id,
          onSent: () => {
            setNudged(true);
          },
        },
      }),
    );
  }, [suggestion.account_id, nudged, dispatch]);

  if (!account) return null;

  return (
    <div className='nudge-suggestion-item'>
      <Link
        to={`/@${account.acct}`}
        className='nudge-suggestion-item__avatar'
        tabIndex={-1}
      >
        <Avatar account={account} size={36} />
      </Link>
      <div className='nudge-suggestion-item__body'>
        <Link to={`/@${account.acct}`} className='nudge-suggestion-item__name'>
          <DisplayName account={account} />
        </Link>
        <span className='nudge-suggestion-item__acct'>@{account.acct}</span>
      </div>
      {nudged ? (
        <Button compact disabled>
          <FormattedMessage id='nudges.nudged_back' defaultMessage='Nudged!' />
        </Button>
      ) : (
        <Button compact onClick={handleNudge}>
          <FormattedMessage
            id='account_nudges.nudge'
            defaultMessage='Nudge @{acct}'
            values={{ acct: account.acct }}
          />
        </Button>
      )}
    </div>
  );
};

// ── Live nudge alert banner ────────────────────────────────────────────────────

interface NudgeAlertData {
  id: string;
  accountId: string;
}

const NudgeAlert: React.FC<{
  alert: NudgeAlertData;
  onDismiss: (id: string) => void;
}> = ({ alert, onDismiss }) => {
  const dispatch = useAppDispatch();
  const account = useAppSelector((state) =>
    state.accounts.get(alert.accountId),
  );
  const [nudgedBack, setNudgedBack] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      onDismiss(alert.id);
    }, 8000);
    return () => {
      window.clearTimeout(t);
    };
  }, [alert.id, onDismiss]);

  const handleDismiss = useCallback(() => {
    onDismiss(alert.id);
  }, [onDismiss, alert.id]);

  const handleNudgeBack = useCallback(() => {
    if (nudgedBack) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId: alert.accountId,
          onSent: () => {
            setNudgedBack(true);
            dispatch(decrementNudgeCount());
          },
        },
      }),
    );
  }, [alert.accountId, nudgedBack, dispatch]);

  if (!account) return null;

  return (
    <div className='nudge-alert'>
      <Icon
        id='partner_exchange'
        icon={PartnerExchangeActiveIcon}
        className='nudge-alert__icon'
      />
      <span className='nudge-alert__text'>
        <FormattedMessage
          id='nudges.alert.nudged_by'
          defaultMessage='<a>@{acct}</a> has nudged you'
          values={{
            acct: account.acct,
            a: (chunks) => <Link to={`/@${account.acct}`}>{chunks}</Link>,
          }}
        />
      </span>
      <Button compact disabled={nudgedBack} onClick={handleNudgeBack}>
        {nudgedBack ? (
          <FormattedMessage id='nudges.nudged_back' defaultMessage='Nudged!' />
        ) : (
          <FormattedMessage
            id='nudges.nudge_back'
            defaultMessage='Nudge back'
          />
        )}
      </Button>
      <button
        className='nudge-alert__dismiss'
        onClick={handleDismiss}
        aria-label='Dismiss'
      >
        ×
      </button>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const NudgesPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  // Inbox state
  const [partners, setPartners] = useState<ApiNudgePartner[]>([]);
  const [suggestions, setSuggestions] = useState<ApiNudgeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<NudgeAlertData[]>([]);

  // Messenger navigation
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    null,
  );

  const seenGroupsRef = useRef<Map<string, string> | null>(null);

  const nudgeGroups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter((g): g is NotificationGroupNudge => g.type === 'nudge'),
  );

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetNudgePartners();
      if (data.accounts.length) dispatch(importFetchedAccounts(data.accounts));
      setPartners(
        [...data.partners].sort((a, b) =>
          (b.last_nudge_at ?? '').localeCompare(a.last_nudge_at ?? ''),
        ),
      );
      setSuggestions(data.suggestions);
      dispatch(setUnreadNudgeCount(data.pending_count));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void load();
  }, [load]);

  // Watch for new live nudges and show banners
  useEffect(() => {
    if (seenGroupsRef.current === null) {
      seenGroupsRef.current = new Map(
        nudgeGroups.map((g) => [g.group_key, g.latest_page_notification_at]),
      );
      return;
    }

    const seenGroups = seenGroupsRef.current;
    const newAlerts: NudgeAlertData[] = [];
    nudgeGroups.forEach((group) => {
      const seen = seenGroups.get(group.group_key);
      if (seen !== group.latest_page_notification_at) {
        const accountId = group.sampleAccountIds[0];
        if (accountId) {
          newAlerts.push({
            id: `${group.group_key}-${group.latest_page_notification_at}`,
            accountId,
          });
        }
        seenGroups.set(group.group_key, group.latest_page_notification_at);
      }
    });

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
      void load();
    }
  }, [nudgeGroups, load]);

  const handleOpenThread = useCallback((accountId: string) => {
    setSelectedPartnerId(accountId);
  }, []);

  const handleBackToInbox = useCallback(() => {
    setSelectedPartnerId(null);
  }, []);

  const handleNudgeSent = useCallback(() => {
    void load();
  }, [load]);

  return (
    <Column
      bindToDocument={!multiColumn}
      label={intl.formatMessage(messages.title)}
    >
      <ColumnHeader
        icon='partner_exchange'
        iconComponent={PartnerExchangeActiveIcon}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn}
        showBackButton={selectedPartnerId === null}
      />

      {alerts.length > 0 && selectedPartnerId === null && (
        <div className='nudge-alerts'>
          {alerts.map((alert) => (
            <NudgeAlert key={alert.id} alert={alert} onDismiss={dismissAlert} />
          ))}
        </div>
      )}

      {selectedPartnerId !== null ? (
        <NudgeThreadView
          partnerId={selectedPartnerId}
          onBack={handleBackToInbox}
          onNudgeSent={handleNudgeSent}
        />
      ) : (
        <div className='scrollable nudge-inbox'>
          {loading && (
            <div className='loading-indicator'>
              <div className='loading-indicator__figure' />
            </div>
          )}

          {!loading && partners.length === 0 && suggestions.length === 0 && (
            <div className='empty-column-indicator'>
              <FormattedMessage
                id='nudges.empty'
                defaultMessage='No nudges yet. Go nudge someone cute!'
              />
            </div>
          )}

          {!loading &&
            partners.map((partner) => (
              <NudgeConversationRow
                key={partner.account_id}
                partner={partner}
                onOpen={handleOpenThread}
              />
            ))}

          {!loading && suggestions.length > 0 && (
            <>
              <div className='nudge-section-header nudge-section-header--suggestions'>
                <FormattedMessage
                  id='nudges.section_suggestions'
                  defaultMessage='NUDGE SOMEONE'
                />
              </div>
              {suggestions.map((s) => (
                <NudgeSuggestionItem key={s.account_id} suggestion={s} />
              ))}
            </>
          )}
        </div>
      )}

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

export default NudgesPage;
