import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useParams, Link } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import {
  apiGetNudgeConversation,
  apiLeaveNudgeConversation,
  apiMuteNudgeConversation,
  apiUnmuteNudgeConversation,
} from 'mastodon/api/nudges_conversations';
import type { ApiNudgeConversationDetail } from 'mastodon/api_types/nudges_conversations';
import { Avatar } from 'mastodon/components/avatar';
import { Stage } from 'mastodon/components/stage';
import { createAccountFromServerJSON } from 'mastodon/models/account';

// Per-conversation settings surface — the "chat info" screen a Signal
// user opens by tapping the chat's header. Notification, mute, leave
// options; group name/description/avatar edit (seeder-only) lands in
// a follow-up alongside the picker widgets.
//
// Rendered as a full Stage so it takes over the pane the same way the
// notification settings do — leaving the messenger sidebar behind
// mirrors Signal's mental model (you're INSIDE this chat's info, not
// still browsing the list).

const messages = defineMessages({
  titleMate: {
    id: 'nudges.settings.title_mate',
    defaultMessage: 'Chat with {name}',
  },
  titleFallback: {
    id: 'nudges.settings.title_fallback',
    defaultMessage: 'Chat settings',
  },
  back: { id: 'nudges.settings.back', defaultMessage: 'Back to chat' },
  memberCount: {
    id: 'nudges.settings.member_count',
    defaultMessage: '{count, plural, one {# member} other {# members}}',
  },

  sectionNotifications: {
    id: 'nudges.settings.section.notifications',
    defaultMessage: 'Notifications',
  },
  mute: { id: 'nudges.settings.mute', defaultMessage: 'Mute this chat' },
  muteHint: {
    id: 'nudges.settings.mute_hint',
    defaultMessage:
      'Silence pings for this conversation only. Messages still arrive; the badge stays quiet.',
  },
  globalPrefs: {
    id: 'nudges.settings.global_prefs',
    defaultMessage: 'All nudges notification settings',
  },
  globalPrefsHint: {
    id: 'nudges.settings.global_prefs_hint',
    defaultMessage:
      'What kinds of nudges reach you across every conversation — the account-wide preferences.',
  },

  sectionMembers: {
    id: 'nudges.settings.section.members',
    defaultMessage: 'Members',
  },

  sectionActions: {
    id: 'nudges.settings.section.actions',
    defaultMessage: 'This chat',
  },
  leave: { id: 'nudges.settings.leave', defaultMessage: 'Leave the Krew' },
  leaveHint: {
    id: 'nudges.settings.leave_hint',
    defaultMessage:
      'Removes you from the Krew. You keep past messages but stop receiving new ones. Rejoining needs a fresh invite.',
  },
  leaveConfirm: {
    id: 'nudges.settings.leave_confirm',
    defaultMessage: 'Leave this Krew? You will also leave the group.',
  },
  loading: { id: 'nudges.settings.loading', defaultMessage: 'Loading…' },
  unavailable: {
    id: 'nudges.settings.unavailable',
    defaultMessage: 'Conversation not available.',
  },
});

const ConversationSettings: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [detail, setDetail] = useState<ApiNudgeConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [muteBusy, setMuteBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const d = await apiGetNudgeConversation(conversationId);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const handleToggleMute = useCallback(() => {
    if (!detail || muteBusy) return;
    setMuteBusy(true);
    const muted = detail.conversation.muted;
    void (async () => {
      try {
        const updated = muted
          ? await apiUnmuteNudgeConversation(conversationId)
          : await apiMuteNudgeConversation(conversationId);
        setDetail({
          ...detail,
          conversation: { ...detail.conversation, ...updated },
        });
      } finally {
        setMuteBusy(false);
      }
    })();
  }, [conversationId, detail, muteBusy]);

  const handleLeave = useCallback(() => {
    if (!detail || leaveBusy) return;
    if (!window.confirm(intl.formatMessage(messages.leaveConfirm))) return;
    setLeaveBusy(true);
    void (async () => {
      try {
        await apiLeaveNudgeConversation(conversationId);
        history.push('/nudges');
      } finally {
        setLeaveBusy(false);
      }
    })();
  }, [conversationId, detail, intl, leaveBusy, history]);

  const stageLabel = intl.formatMessage(messages.titleFallback);

  if (loading && !detail) {
    return (
      <Stage label={stageLabel}>
        <div className='nudges-settings'>
          <p className='nudges-settings__status'>
            {intl.formatMessage(messages.loading)}
          </p>
        </div>
      </Stage>
    );
  }

  if (!detail) {
    return (
      <Stage label={stageLabel}>
        <div className='nudges-settings'>
          <p className='nudges-settings__status'>
            {intl.formatMessage(messages.unavailable)}
          </p>
        </div>
      </Stage>
    );
  }

  const { conversation } = detail;
  const isKrew = conversation.kind === 'krew';
  const other = conversation.other_account
    ? createAccountFromServerJSON(conversation.other_account)
    : null;
  const krewName = conversation.krew?.name ?? 'Krew';
  const otherDisplay = other?.display_name;
  const displayName =
    otherDisplay && otherDisplay.length > 0
      ? otherDisplay
      : (other?.username ?? (isKrew ? krewName : 'Chat'));
  const title = isKrew
    ? krewName
    : intl.formatMessage(messages.titleMate, { name: displayName });

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='nudges-settings'>
        <header className='nudges-settings__head'>
          <Link
            to={`/nudges/${conversationId}`}
            className='nudges-settings__back'
            aria-label={intl.formatMessage(messages.back)}
          >
            <ArrowBackIcon />
          </Link>
          <h1 className='nudges-settings__title'>{title}</h1>
        </header>

        <div className='nudges-settings__hero'>
          {isKrew ? (
            <span className='nudges-settings__hero-avatar' aria-hidden>
              <GroupsIcon />
            </span>
          ) : other ? (
            <span className='nudges-settings__hero-avatar'>
              <Avatar account={other} size={72} />
            </span>
          ) : null}
          <div className='nudges-settings__hero-name'>{displayName}</div>
          {isKrew && conversation.krew && (
            <div className='nudges-settings__hero-meta'>
              {intl.formatMessage(messages.memberCount, {
                count: conversation.krew.member_count,
              })}
            </div>
          )}
        </div>

        <section className='nudges-settings__section'>
          <h2 className='nudges-settings__section-heading'>
            {intl.formatMessage(messages.sectionNotifications)}
          </h2>
          <div className='nudges-settings__row'>
            <div className='nudges-settings__row-body'>
              <div className='nudges-settings__row-label'>
                {intl.formatMessage(messages.mute)}
              </div>
              <div className='nudges-settings__row-hint'>
                {intl.formatMessage(messages.muteHint)}
              </div>
            </div>
            <label className='nudges-settings__toggle'>
              <input
                type='checkbox'
                checked={conversation.muted}
                onChange={handleToggleMute}
                disabled={muteBusy}
                aria-label={intl.formatMessage(messages.mute)}
              />
              <span
                className='nudges-settings__toggle-track'
                aria-hidden='true'
              />
            </label>
          </div>

          <Link
            to='/settings/notifications'
            className='nudges-settings__action-row'
          >
            <NotificationsIcon aria-hidden />
            <div className='nudges-settings__row-body'>
              <div className='nudges-settings__row-label'>
                {intl.formatMessage(messages.globalPrefs)}
              </div>
              <div className='nudges-settings__row-hint'>
                {intl.formatMessage(messages.globalPrefsHint)}
              </div>
            </div>
          </Link>
        </section>

        {isKrew && (
          <section className='nudges-settings__section'>
            <h2 className='nudges-settings__section-heading'>
              <FormattedMessage
                id='nudges.settings.section.actions_krew'
                defaultMessage='This Krew'
              />
            </h2>
            <button
              type='button'
              className='nudges-settings__action-row nudges-settings__action-row--danger'
              onClick={handleLeave}
              disabled={leaveBusy}
            >
              <div className='nudges-settings__row-body'>
                <div className='nudges-settings__row-label'>
                  {intl.formatMessage(messages.leave)}
                </div>
                <div className='nudges-settings__row-hint'>
                  {intl.formatMessage(messages.leaveHint)}
                </div>
              </div>
            </button>
          </section>
        )}
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default ConversationSettings;
