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
import { apiGetNudgeThread, apiNudgeAccount } from 'mastodon/api/accounts';
import type { ApiNudgeThreadMessage } from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import type { NotificationGroupNudge } from 'mastodon/models/notification_group';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const MAX_WORDS = 100;
const MAX_VOICE_SECONDS = 60;

interface ConfirmPayload {
  type: 'image' | 'video' | 'voice';
  src: string;
  mediaId?: string;
  blob?: Blob;
  durationSeconds?: number;
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

async function uploadBlob(blob: Blob, csrfToken: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'voice.webm');
  const res = await fetch('/api/v2/media', {
    method: 'POST',
    body: form,
    headers: { 'X-CSRF-Token': csrfToken },
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('upload failed');
  const json = (await res.json()) as { id: string };
  return json.id;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const MessageBubble: React.FC<{ msg: ApiNudgeThreadMessage }> = ({ msg }) => {
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

  return (
    <div
      className={`nudge-bubble nudge-bubble--${isSent ? 'sent' : 'received'}`}
    >
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
  confirmSend: {
    id: 'nudges.confirm.send',
    defaultMessage: 'Send',
  },
  confirmCancel: {
    id: 'nudges.confirm.cancel',
    defaultMessage: 'Cancel',
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

  const account = useAppSelector((state) => state.accounts.get(accountId));

  const [threadMessages, setThreadMessages] = useState<ApiNudgeThreadMessage[]>(
    [],
  );
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [text, setText] = useState('');
  const [mediaId, setMediaId] = useState<string | undefined>();
  const [mediaPreview, setMediaPreview] = useState<string | undefined>();
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const [voiceBlob, setVoiceBlob] = useState<Blob | undefined>();
  const [recording, setRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // Pre-send confirmation state
  const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(
    null,
  );

  const wordCount = countWords(text);
  const overLimit = wordCount > MAX_WORDS;

  const loadThread = useCallback(async () => {
    if (accountId === '') return;
    try {
      const data = await apiGetNudgeThread(accountId);
      dispatch(importFetchedAccounts([data.account]));
      setThreadMessages(data.messages);
      setStreak(data.streak);
    } finally {
      setLoading(false);
    }
  }, [accountId, dispatch]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  // Auto-scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

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
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [],
  );

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(true);
      void (async () => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const csrfMeta = document.querySelector<HTMLMetaElement>(
            'meta[name="csrf-token"]',
          );
          const response = await fetch('/api/v2/media', {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRF-Token': csrfMeta?.content ?? '' },
            credentials: 'same-origin',
          });
          if (response.ok) {
            const json = (await response.json()) as { id: string };
            const isVideo = file.type.startsWith('video/');
            setConfirmPayload({
              type: isVideo ? 'video' : 'image',
              src: URL.createObjectURL(file),
              mediaId: json.id,
            });
          }
        } finally {
          setUploading(false);
        }
      })();
    },
    [],
  );

  const handleRemoveMedia = useCallback(() => {
    setMediaId(undefined);
    setMediaPreview(undefined);
    setMediaIsVideo(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const startRecording = useCallback(() => {
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => {
            t.stop();
          });
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const seconds = voiceSecondsRef.current;
          setRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          setConfirmPayload({
            type: 'voice',
            src: URL.createObjectURL(blob),
            blob,
            durationSeconds: seconds,
          });
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
  }, []);

  // Confirm: move payload into compose state
  const handleConfirmMedia = useCallback(() => {
    if (!confirmPayload) return;
    if (confirmPayload.type === 'voice' && confirmPayload.blob) {
      setVoiceBlob(confirmPayload.blob);
      setVoiceSeconds(confirmPayload.durationSeconds ?? 0);
    } else {
      setMediaId(confirmPayload.mediaId);
      setMediaPreview(confirmPayload.src);
      setMediaIsVideo(confirmPayload.type === 'video');
    }
    setConfirmPayload(null);
  }, [confirmPayload]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmPayload(null);
  }, []);

  const clearCompose = useCallback(() => {
    setText('');
    setMediaId(undefined);
    setMediaPreview(undefined);
    setMediaIsVideo(false);
    setVoiceId(undefined);
    setVoiceBlob(undefined);
    setVoiceSeconds(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  const send = useCallback(
    async (withContent: boolean) => {
      if (accountId === '' || sending) return;
      setSending(true);
      try {
        const csrfMeta = document.querySelector<HTMLMetaElement>(
          'meta[name="csrf-token"]',
        );
        const csrfToken = csrfMeta?.content ?? '';

        let resolvedVoiceId = voiceId;
        if (withContent && voiceBlob && !voiceId) {
          resolvedVoiceId = await uploadBlob(voiceBlob, csrfToken);
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
        dispatch(decrementNudgeCount());
        clearCompose();
        await loadThread();
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
              <span className='nudge-thread-banner__streak'>
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
              <MessageBubble key={msg.notification_id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className='nudge-compose-bar'>
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
                  <audio
                    controls
                    src={voiceBlob ? URL.createObjectURL(voiceBlob) : undefined}
                  />
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
              disabled={uploading || !!mediaId}
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
              disabled={sending}
            />

            {!voiceBlob && !voiceId && (
              <button
                type='button'
                className={`nudge-compose-bar__icon-btn${recording ? ' nudge-compose-bar__icon-btn--recording' : ''}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={sending}
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
              disabled={sending || overLimit}
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

        {/* Media / voice confirmation overlay */}
        {confirmPayload && (
          <div
            className='nudge-confirm-overlay'
            role='dialog'
            aria-modal='true'
          >
            <div className='nudge-confirm-modal'>
              <div className='nudge-confirm-modal__preview'>
                {confirmPayload.type === 'voice' && (
                  <div className='nudge-confirm-modal__voice'>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio
                      controls
                      autoPlay={false}
                      src={confirmPayload.src}
                      className='nudge-confirm-modal__audio'
                    />
                    {confirmPayload.durationSeconds !== undefined && (
                      <span className='nudge-confirm-modal__duration'>
                        <FormattedMessage
                          id='nudges.confirm.duration'
                          defaultMessage='{s}s voice memo'
                          values={{ s: confirmPayload.durationSeconds }}
                        />
                      </span>
                    )}
                  </div>
                )}
                {confirmPayload.type === 'video' && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    controls
                    src={confirmPayload.src}
                    className='nudge-confirm-modal__video'
                  />
                )}
                {confirmPayload.type === 'image' && (
                  <img
                    src={confirmPayload.src}
                    alt=''
                    className='nudge-confirm-modal__image'
                  />
                )}
              </div>

              <p className='nudge-confirm-modal__caption'>
                <FormattedMessage
                  id='nudges.confirm.caption'
                  defaultMessage='Send to {name}?'
                  values={{ name: title }}
                />
              </p>

              <div className='nudge-confirm-modal__actions'>
                <button
                  type='button'
                  className='nudge-confirm-modal__btn nudge-confirm-modal__btn--cancel'
                  onClick={handleCancelConfirm}
                >
                  {intl.formatMessage(messages.confirmCancel)}
                </button>
                <button
                  type='button'
                  className='nudge-confirm-modal__btn nudge-confirm-modal__btn--send'
                  onClick={handleConfirmMedia}
                >
                  {intl.formatMessage(messages.confirmSend)}
                </button>
              </div>
            </div>
          </div>
        )}
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
