import { useEffect, useState, useCallback, useRef } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import AddPhotoIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import ArrowUpwardIcon from '@/material-icons/400-24px/arrow_upward-fill.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange-fill.svg?react';
import StopIcon from '@/material-icons/400-24px/stop.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { decrementNudgeCount } from 'mastodon/actions/notification_groups';
import api from 'mastodon/api';
import { apiGetNudgeThread, apiNudgeAccount } from 'mastodon/api/accounts';
import type { ApiNudgeThreadMessage } from 'mastodon/api/accounts';
import { apiNudgeReact, apiNudgeUnreact } from 'mastodon/api/notifications';
import { Avatar } from 'mastodon/components/avatar';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import type { Account } from 'mastodon/models/account';
import type { NotificationGroupNudge } from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const MAX_WORDS = 100;
const MAX_VOICE_SECONDS = 60;
const REACTION_EMOJIS = ['❤️', '😂', '🙌', '🔥', '😢'] as const;

const ReactionButton: React.FC<{
  emoji: string;
  count: number;
  me: boolean;
  notificationId: string;
  onReact: (
    notificationId: string,
    emoji: string,
    currentlyMe: boolean,
  ) => void;
}> = ({ emoji, count, me, notificationId, onReact }) => {
  const handleClick = useCallback(() => {
    onReact(notificationId, emoji, me);
  }, [onReact, notificationId, emoji, me]);

  return (
    <button
      type='button'
      className={`nudge-bubble__react-btn${me ? ' nudge-bubble__react-btn--me' : ''}`}
      onClick={handleClick}
      aria-label={`${emoji}${count > 0 ? ` ${count}` : ''}`}
    >
      <span>{emoji}</span>
      {count > 0 && <span className='nudge-bubble__react-count'>{count}</span>}
    </button>
  );
};

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

async function uploadBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'voice.webm');
  const { data } = await api().post<{ id: string }>('/api/v2/media', form);
  // Poll until the server has finished processing the audio file
  for (let i = 0; i < 20; i++) {
    const check = await api().get(`/api/v1/media/${data.id}`);
    if (check.status === 200) break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return data.id;
}

function pingSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // audio unavailable
  }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const timeStr = d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return timeStr;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday ${timeStr}`;
  if (diff < 7 * 86_400_000) {
    return `${d.toLocaleDateString([], { weekday: 'short' })} ${timeStr}`;
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

const MessageBubble: React.FC<{
  msg: ApiNudgeThreadMessage;
  partnerAccount?: Account | null;
  isNew?: boolean;
  onReact: (
    notificationId: string,
    emoji: string,
    currentlyMe: boolean,
  ) => void;
}> = ({ msg, partnerAccount, isNew, onReact }) => {
  const isPing =
    msg.body == null && msg.media_url == null && msg.voice_url == null;
  const isSent = msg.direction === 'sent';

  if (isPing) {
    return (
      <div className='nudge-ping'>
        <Icon icon={PartnerExchangeIcon} id='partner_exchange' />
        <span>
          {isSent ? (
            <FormattedMessage
              id='nudges.thread.you_nudged'
              defaultMessage='You nudged'
            />
          ) : (
            <FormattedMessage
              id='nudges.thread.nudged_you'
              defaultMessage='Nudged you'
            />
          )}
        </span>
        <span className='nudge-ping__time'>{formatTime(msg.created_at)}</span>
      </div>
    );
  }

  const hasReactions = REACTION_EMOJIS.some(
    (e) => (msg.reactions[e]?.count ?? 0) > 0,
  );

  return (
    <div
      className={`nudge-bubble nudge-bubble--${isSent ? 'sent' : 'received'}${isNew ? ' nudge-bubble--new' : ''}`}
    >
      {!isSent && partnerAccount && (
        <div className='nudge-bubble__avatar'>
          <Avatar account={partnerAccount} size={28} />
        </div>
      )}
      <div className='nudge-bubble__content'>
        {msg.body && <p className='nudge-bubble__text'>{msg.body}</p>}
        {msg.media_url &&
          (msg.media_content_type?.startsWith('video/') ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              controls
              src={msg.media_url}
              className='nudge-bubble__video'
            />
          ) : (
            <img src={msg.media_url} alt='' className='nudge-bubble__img' />
          ))}
        {msg.voice_url && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls src={msg.voice_url} className='nudge-bubble__audio' />
        )}
        <span className='nudge-bubble__time'>{formatTime(msg.created_at)}</span>
        <div
          className={`nudge-bubble__reactions${hasReactions ? ' nudge-bubble__reactions--active' : ''}`}
        >
          {REACTION_EMOJIS.map((emoji) => {
            const r = msg.reactions[emoji];
            const count = r ? r.count : 0;
            const me = r ? r.me : false;
            return (
              <ReactionButton
                key={emoji}
                emoji={emoji}
                count={count}
                me={me}
                notificationId={msg.notification_id}
                onReact={onReact}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const messages = defineMessages({
  back: { id: 'nudges.back', defaultMessage: 'Nudges' },
  placeholder: {
    id: 'nudges.thread.placeholder',
    defaultMessage: 'Send a message…',
  },
  send: { id: 'nudges.thread.send', defaultMessage: 'Send' },
  nudge: { id: 'nudges.thread.nudge', defaultMessage: 'Nudge' },
  attachMedia: {
    id: 'nudges.thread.attach_media',
    defaultMessage: 'Attach image or video',
  },
  record: { id: 'nudges.thread.record', defaultMessage: 'Record voice memo' },
  stopRecording: {
    id: 'nudges.thread.stop_recording',
    defaultMessage: 'Stop recording',
  },
  removeAttachment: {
    id: 'nudges.thread.remove_attachment',
    defaultMessage: 'Remove',
  },
});

const NudgesThread: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const { accountId = '' } = useParams<{ accountId: string }>();
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const columnRef = useRef<ColumnRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNudgeKeyRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceSecondsRef = useRef(0);
  const isFirstLoadRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  // Optimistic upload: starts immediately when recording stops
  const voiceUploadRef = useRef<Promise<string> | null>(null);

  const account = useAppSelector((state) => state.accounts.get(accountId));

  const [threadMessages, setThreadMessages] = useState<ApiNudgeThreadMessage[]>(
    [],
  );
  const [streak, setStreak] = useState(0);
  const [canNudgeBack, setCanNudgeBack] = useState(true);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [text, setText] = useState('');
  const [mediaId, setMediaId] = useState<string | undefined>();
  const [mediaPreview, setMediaPreview] = useState<string | undefined>();
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const [voiceBlob, setVoiceBlob] = useState<Blob | undefined>();
  const [voiceBlobUrl, setVoiceBlobUrl] = useState<string | undefined>();
  const [recording, setRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streakBumped, setStreakBumped] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  const wordCount = countWords(text);
  const overLimit = wordCount > MAX_WORDS;

  const loadThread = useCallback(async () => {
    if (accountId === '') return;
    try {
      const data = await apiGetNudgeThread(accountId);
      dispatch(importFetchedAccounts([data.account]));
      setThreadMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m.notification_id));
        const incoming = data.messages.filter(
          (m) => !prevIds.has(m.notification_id),
        );
        if (incoming.length > 0 && !isFirstLoadRef.current) {
          const hasIncoming = incoming.some((m) => m.direction === 'received');
          if (hasIncoming) pingSound();
          setNewMessageIds(new Set(incoming.map((m) => m.notification_id)));
          setTimeout(() => {
            setNewMessageIds(new Set());
          }, 600);
        }
        return data.messages;
      });
      setStreak((prev) => {
        if (data.streak > prev && prev > 0) {
          setStreakBumped(true);
          setTimeout(() => {
            setStreakBumped(false);
          }, 800);
        }
        return data.streak;
      });
      setCanNudgeBack(data.can_nudge_back);
    } finally {
      setLoading(false);
    }
  }, [accountId, dispatch]);

  const handleReact = useCallback(
    (notificationId: string, emoji: string, currentlyMe: boolean) => {
      // Optimistic update
      setThreadMessages((prev) =>
        prev.map((m) => {
          if (m.notification_id !== notificationId) return m;
          const updated = { ...m, reactions: { ...m.reactions } };
          if (currentlyMe) {
            // Remove reaction
            const r = updated.reactions[emoji];
            updated.reactions[emoji] = {
              count: Math.max(0, (r ? r.count : 1) - 1),
              me: false,
            };
          } else {
            // Clear any existing my-reaction, add new one
            for (const e of REACTION_EMOJIS) {
              const er = updated.reactions[e];
              if (er?.me) {
                updated.reactions[e] = {
                  count: Math.max(0, er.count - 1),
                  me: false,
                };
              }
            }
            const r = updated.reactions[emoji];
            updated.reactions[emoji] = {
              count: (r ? r.count : 0) + 1,
              me: true,
            };
          }
          return updated;
        }),
      );
      void (async () => {
        try {
          if (currentlyMe) {
            await apiNudgeUnreact(notificationId);
          } else {
            await apiNudgeReact(notificationId, emoji);
          }
        } catch {
          // revert on failure
          void loadThread();
        }
      })();
    },
    [loadThread],
  );

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  // Auto-focus compose input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Manage voice blob object URL — create once, revoke on change or unmount
  useEffect(() => {
    if (!voiceBlob) return;
    const url = URL.createObjectURL(voiceBlob);
    setVoiceBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setVoiceBlobUrl(undefined);
    };
  }, [voiceBlob]);

  // Auto-scroll: instant on first load, smooth only when count increases
  useEffect(() => {
    if (threadMessages.length === 0) return;
    const count = threadMessages.length;
    if (isFirstLoadRef.current) {
      messagesEndRef.current?.scrollIntoView();
      isFirstLoadRef.current = false;
      prevMessageCountRef.current = count;
    } else if (count > prevMessageCountRef.current) {
      prevMessageCountRef.current = count;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadMessages]);

  // 5-second auto-reload — paused while user is sending or recording
  useEffect(() => {
    const id = setInterval(() => {
      if (!sending && !recording) void loadThread();
    }, 5000);
    return () => {
      clearInterval(id);
    };
  }, [sending, recording, loadThread]);

  // Cleanup media recorder on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
    },
    [],
  );

  // Listen for incoming nudges from this account and reload thread
  const nudgeGroups = useAppSelector((state) =>
    [
      ...state.notificationGroups.groups,
      ...state.notificationGroups.pendingGroups,
    ].filter(
      (g): g is NotificationGroupNudge =>
        g.type === 'nudge' && g.sampleAccountIds.includes(accountId),
    ),
  );

  useEffect(() => {
    const latest = nudgeGroups[0];
    if (!latest) return;
    const key = latest.latest_page_notification_at;
    if (key !== lastNudgeKeyRef.current) {
      lastNudgeKeyRef.current = key;
      void loadThread();
    }
  }, [nudgeGroups, loadThread]);

  // Auto-resize textarea
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      setError(null);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [],
  );

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Messenger-style: upload immediately, show thumbnail in compose bar — no modal
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(null);
      setUploading(true);
      void (async () => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const { data } = await api().post<{ id: string }>(
            '/api/v2/media',
            formData,
          );
          const previewUrl = URL.createObjectURL(file);
          setMediaId(data.id);
          setMediaPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return previewUrl;
          });
          setMediaIsVideo(file.type.startsWith('video/'));
        } catch (err) {
          setError(
            `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        } finally {
          setUploading(false);
        }
      })();
    },
    [],
  );

  const handleRemoveMedia = useCallback(() => {
    setMediaId(undefined);
    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return undefined;
    });
    setMediaIsVideo(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 128_000,
        });
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => {
            t.stop();
          });
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          const seconds = voiceSecondsRef.current;
          setRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          // Set blob in compose bar immediately (Messenger-style)
          setVoiceBlob(blob);
          setVoiceSeconds(seconds);
          // Start uploading in background so send() is instant
          voiceUploadRef.current = uploadBlob(blob);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setRecording(true);
        setVoiceSeconds(0);
        voiceSecondsRef.current = 0;
        timerRef.current = setInterval(() => {
          setVoiceSeconds((s) => {
            const next = s + 1;
            voiceSecondsRef.current = next;
            if (next >= MAX_VOICE_SECONDS) {
              recorder.stop();
            }
            return next;
          });
        }, 1000);
      } catch {
        // mic permission denied
      }
    })();
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const handleRemoveVoice = useCallback(() => {
    setVoiceId(undefined);
    setVoiceBlob(undefined);
    setVoiceSeconds(0);
    setError(null);
    voiceUploadRef.current = null;
  }, []);

  const clearCompose = useCallback(() => {
    setText('');
    setMediaId(undefined);
    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return undefined;
    });
    setMediaIsVideo(false);
    setVoiceId(undefined);
    setVoiceBlob(undefined);
    setVoiceSeconds(0);
    voiceUploadRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  const send = useCallback(
    async (withContent: boolean) => {
      if (accountId === '' || sending) return;
      setSending(true);
      setError(null);
      try {
        let resolvedVoiceId = voiceId;
        if (withContent && voiceBlob && !voiceId) {
          try {
            // Use optimistic upload if ready, otherwise upload now
            resolvedVoiceId = await (voiceUploadRef.current ??
              uploadBlob(voiceBlob));
          } catch {
            // Optimistic upload failed — retry synchronously
            resolvedVoiceId = await uploadBlob(voiceBlob);
          }
          voiceUploadRef.current = null;
          setVoiceId(resolvedVoiceId);
        }

        const params = withContent
          ? {
              text: text.trim() || undefined,
              media_id: mediaId,
              voice_id: resolvedVoiceId,
            }
          : {};

        const result = await apiNudgeAccount(accountId, params);
        setStreak(result.streak);
        setCanNudgeBack(result.can_nudge);
        dispatch(decrementNudgeCount());
        clearCompose();
        await loadThread();
      } catch (err: unknown) {
        const status =
          err != null &&
          typeof err === 'object' &&
          'response' in err &&
          err.response != null &&
          typeof err.response === 'object' &&
          'data' in err.response
            ? (err.response as { data?: { error?: string } }).data?.error
            : null;
        const msg =
          status === 'waiting_for_nudge_back'
            ? 'Waiting for them to nudge back first'
            : 'Failed to send — try again';
        setCanNudgeBack(status !== 'waiting_for_nudge_back');
        setError(msg);
      } finally {
        setSending(false);
      }
    },
    [
      accountId,
      sending,
      text,
      mediaId,
      voiceId,
      voiceBlob,
      dispatch,
      clearCompose,
      loadThread,
    ],
  );

  const hasContent =
    text.trim().length > 0 || !!mediaId || !!voiceBlob || !!voiceId;

  const handleSend = useCallback(() => {
    void send(hasContent);
  }, [send, hasContent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  const title = account ? account.display_name || account.acct : '…';

  return (
    <Column bindToDocument={!multiColumn} ref={columnRef} label={title}>
      <ColumnHeader
        icon='partner_exchange'
        iconComponent={PartnerExchangeIcon}
        title={title}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
        showBackButton
      />

      <div className='nudge-thread'>
        {account && (
          <div className='nudge-thread-banner'>
            <Avatar account={account} size={40} />
            <div className='nudge-thread-banner__info'>
              <span className='nudge-thread-banner__name'>
                {account.display_name || account.acct}
              </span>
              <span className='nudge-thread-banner__acct'>@{account.acct}</span>
            </div>
            {streak > 0 && (
              <span
                className={`nudge-thread-banner__streak${streakBumped ? ' nudge-thread-banner__streak--bump' : ''}`}
              >
                <Icon icon={PartnerExchangeIcon} id='partner_exchange' />
                {streak}
              </span>
            )}
          </div>
        )}
        {loading && (
          <div className='loading-indicator'>
            <div className='loading-indicator__figure' />
          </div>
        )}

        {!loading && threadMessages.length === 0 && (
          <div className='empty-column-indicator'>
            <FormattedMessage
              id='nudges.thread.empty'
              defaultMessage='No messages yet. Send a nudge!'
            />
          </div>
        )}

        {!loading && threadMessages.length > 0 && (
          <div className='nudge-thread__messages'>
            {threadMessages.map((msg) => (
              <MessageBubble
                key={msg.notification_id}
                msg={msg}
                isNew={newMessageIds.has(msg.notification_id)}
                partnerAccount={
                  msg.direction === 'received' ? account : undefined
                }
                onReact={handleReact}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {!canNudgeBack && !loading && (
          <div className='nudge-compose-bar__waiting'>
            <FormattedMessage
              id='nudges.thread.waiting'
              defaultMessage='Waiting for them to nudge back…'
            />
          </div>
        )}

        {error && <div className='nudge-compose-bar__error'>{error}</div>}

        <div
          className={`nudge-compose-bar${!canNudgeBack ? ' nudge-compose-bar--disabled' : ''}`}
        >
          {(mediaPreview !== undefined ||
            voiceBlob !== undefined ||
            voiceId !== undefined) && (
            <div className='nudge-compose-bar__attachments'>
              {mediaPreview && (
                <div className='nudge-compose-bar__attachment-preview'>
                  {mediaIsVideo ? (
                    <video
                      src={mediaPreview}
                      className='nudge-compose-bar__media-preview'
                      muted
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt=''
                      className='nudge-compose-bar__media-preview'
                    />
                  )}
                  <button
                    type='button'
                    className='nudge-compose-bar__remove-btn'
                    onClick={handleRemoveMedia}
                    aria-label={intl.formatMessage(messages.removeAttachment)}
                  >
                    ×
                  </button>
                </div>
              )}
              {(voiceBlob ?? voiceId) && (
                <div className='nudge-compose-bar__attachment-preview nudge-compose-bar__attachment-preview--voice'>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={voiceBlobUrl} />
                  <button
                    type='button'
                    className='nudge-compose-bar__remove-btn'
                    onClick={handleRemoveVoice}
                    aria-label={intl.formatMessage(messages.removeAttachment)}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          <div className='nudge-compose-bar__row'>
            <button
              type='button'
              className='nudge-compose-bar__icon-btn'
              onClick={handleAttachClick}
              disabled={uploading || !!mediaId || !canNudgeBack}
              aria-label={intl.formatMessage(messages.attachMedia)}
              title={intl.formatMessage(messages.attachMedia)}
            >
              <Icon icon={AddPhotoIcon} id='add_photo_alternate' />
            </button>

            <input
              ref={fileInputRef}
              type='file'
              accept='image/*,video/*'
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <textarea
              ref={textareaRef}
              className={`nudge-compose-bar__input${overLimit ? ' nudge-compose-bar__input--over' : ''}`}
              placeholder={intl.formatMessage(messages.placeholder)}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending || !canNudgeBack}
            />

            {!voiceBlob && !voiceId && (
              <button
                type='button'
                className={`nudge-compose-bar__icon-btn${recording ? ' nudge-compose-bar__icon-btn--recording' : ''}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={sending || !canNudgeBack}
                aria-label={intl.formatMessage(
                  recording ? messages.stopRecording : messages.record,
                )}
                title={intl.formatMessage(
                  recording ? messages.stopRecording : messages.record,
                )}
              >
                {recording ? (
                  <>
                    <Icon icon={StopIcon} id='stop' />
                    <span className='nudge-compose-bar__rec-timer'>
                      {voiceSeconds}s
                    </span>
                  </>
                ) : (
                  <Icon icon={MicIcon} id='mic' />
                )}
              </button>
            )}

            <button
              type='button'
              className={`nudge-compose-bar__icon-btn nudge-compose-bar__icon-btn--send${sending ? ' nudge-compose-bar__icon-btn--sending' : ''}`}
              onClick={handleSend}
              disabled={sending || overLimit || !canNudgeBack}
              aria-label={intl.formatMessage(
                hasContent ? messages.send : messages.nudge,
              )}
              title={intl.formatMessage(
                hasContent ? messages.send : messages.nudge,
              )}
            >
              {hasContent ? (
                <Icon icon={ArrowUpwardIcon} id='arrow_upward' />
              ) : (
                <Icon icon={PartnerExchangeIcon} id='partner_exchange' />
              )}
            </button>
          </div>
        </div>
      </div>

      <Helmet>
        <title>{title} — Nudges</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default NudgesThread;
