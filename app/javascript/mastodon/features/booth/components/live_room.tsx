import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useHistory } from 'react-router-dom';

import { showAlert } from 'mastodon/actions/alerts';
import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { jitsiDomain, me } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import type { BoothLive } from '../types';

import { RemindButton } from './remind_button';

// A live set's room (docs/spaces/booth.md, Live sets), on Huddle's Jitsi
// server. The host gets a get-ready panel, then joins with Jitsi's audio
// processing off and stereo at a high bitrate, so music comes through as
// music and not as a voice call. Listeners tap Listen in (browsers only
// play sound after a tap) and join muted with chat, reactions and a
// raised hand. The page polls the set while you wait, so Listen in
// appears when the host goes live, and asks the Jitsi server how many
// people are in the room, the way Huddle's lobby does.

const POLL_SET_MS = 20_000;
const POLL_COUNT_MS = 15_000;

// The configured Jitsi server, used only if it is a bare host name
// (`meet.example.org`, optionally with a port), never anything that could
// change what the script URL means.
const JITSI_HOST = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(jitsiDomain)
  ? jitsiDomain
  : null;

// Jitsi's external API script, loaded once per page however many rooms
// open.
let jitsiScript: Promise<void> | null = null;
function loadJitsi(): Promise<void> {
  if (!JITSI_HOST) return Promise.reject(new Error('No Jitsi server'));
  jitsiScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${JITSI_HOST}/external_api.js`;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      jitsiScript = null;
      reject(new Error('Jitsi failed to load'));
    };
    document.head.appendChild(script);
  });
  return jitsiScript;
}

interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, callback: () => void) => void;
  executeCommand: (command: string, ...args: string[]) => void;
}

type JitsiConstructor = new (
  domain: string,
  options: Record<string, unknown>,
) => JitsiApi;

const jitsiConstructor = (): JitsiConstructor | undefined =>
  (window as unknown as { JitsiMeetExternalAPI?: JitsiConstructor })
    .JitsiMeetExternalAPI;

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  loading: { id: 'booth.live.loading', defaultMessage: 'Opening the room…' },
  notFound: {
    id: 'booth.live.not_found',
    defaultMessage: 'This live set doesn’t exist',
  },
  liveNow: { id: 'booth.live.badge', defaultMessage: 'Live now' },
  startsAt: { id: 'booth.live.starts', defaultMessage: 'Starts {time}' },
  startingSoon: {
    id: 'booth.live.starting_soon',
    defaultMessage: 'Starting soon',
  },
  ended: { id: 'booth.live.ended', defaultMessage: 'This set has ended' },
  endedBody: {
    id: 'booth.live.ended_body',
    defaultMessage: 'If it was recorded, it may turn up in Musik.',
  },
  endedOwner: {
    id: 'booth.live.ended_owner',
    defaultMessage:
      'Recorded it on your set-up? Upload it as a set so people can listen back.',
  },
  uploadRecording: {
    id: 'booth.live.upload_recording',
    defaultMessage: 'Upload the recording',
  },
  backToMusik: {
    id: 'booth.live.back_to_musik',
    defaultMessage: 'Browse sets',
  },
  goLive: { id: 'booth.live.go_live', defaultMessage: 'Go live' },
  rejoin: { id: 'booth.live.rejoin', defaultMessage: 'Back into the room' },
  endSet: { id: 'booth.live.end', defaultMessage: 'End set' },
  endTitle: { id: 'booth.live.end_title', defaultMessage: 'End this set?' },
  endBody: {
    id: 'booth.live.end_body',
    defaultMessage: 'Everyone listening leaves the room, and it can’t restart.',
  },
  remove: { id: 'booth.live.delete', defaultMessage: 'Cancel this set' },
  removeTitle: {
    id: 'booth.live.delete_title',
    defaultMessage: 'Cancel this live set?',
  },
  removeBody: {
    id: 'booth.live.delete_body',
    defaultMessage: 'It comes off the Booth’s Coming up list.',
  },
  listen: { id: 'booth.live.listen', defaultMessage: 'Listen in' },
  leave: { id: 'booth.live.leave', defaultMessage: 'Leave' },
  waiting: {
    id: 'booth.live.waiting',
    defaultMessage:
      'The host hasn’t started yet. Stay on this page and Listen in appears when they go live.',
  },
  wentLive: { id: 'booth.live.went_live', defaultMessage: 'You’re live' },
  announced: {
    id: 'booth.live.announced',
    defaultMessage: 'You’re live, and your feed has been told',
  },
  readyTitle: {
    id: 'booth.live.ready_title',
    defaultMessage: 'Before you go live',
  },
  tipInput: {
    id: 'booth.live.tip_input',
    defaultMessage:
      'Plug in your mixer or audio interface. When the room opens, pick it as your microphone.',
  },
  tipComputer: {
    id: 'booth.live.tip_computer',
    defaultMessage:
      'Playing from your computer? Use Share screen, pick the tab or window, and turn on “Share audio”.',
  },
  tipHeadphones: {
    id: 'booth.live.tip_headphones',
    defaultMessage:
      'Wear headphones, so the room doesn’t play back into your mic.',
  },
  tipRecord: {
    id: 'booth.live.tip_record',
    defaultMessage:
      'Kronk doesn’t record the room. Record on your own set-up and upload it as a set afterwards.',
  },
  tipSize: {
    id: 'booth.live.tip_size',
    defaultMessage: 'A room plays best to up to about 35 people.',
  },
  host: { id: 'booth.live.host', defaultMessage: 'Hosted by {name}' },
});

interface Props {
  id: string;
  // Set by the composer for "Go live now": the reach to tell the feed at
  // once the host goes live.
  announce: ReachValue | null;
}

export const LiveRoom: React.FC<Props> = ({ id, announce }) => {
  const intl = useIntl();
  const history = useHistory();
  const dispatch = useAppDispatch();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [live, setLive] = useState<BoothLive | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listeners, setListeners] = useState<number | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const jitsiRef = useRef<JitsiApi | null>(null);
  const account = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  const state = live?.state;

  // The set itself, polled while you wait for it to start or sit in it,
  // so its state follows the host.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api()
        .get<BoothLive>(`/api/v1/booth_lives/${id}`)
        .then((res) => {
          if (!cancelled) setLive(res.data);
          return undefined;
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    void load();
    const timer = setInterval(() => void load(), POLL_SET_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  // Who's in the room, from the Jitsi server (Huddle's lobby does the same).
  const roomKey = live?.room_key;
  useEffect(() => {
    if (state !== 'live' || !roomKey || !JITSI_HOST) return undefined;
    let cancelled = false;
    const count = async () => {
      try {
        const res = await fetch(
          `https://${JITSI_HOST}/room?room=${encodeURIComponent(roomKey)}&domain=meet.jitsi`,
        );
        const people = res.ok ? ((await res.json()) as unknown[]) : [];
        if (!cancelled) setListeners(people.length);
      } catch {
        if (!cancelled) setListeners(null);
      }
    };
    void count();
    const timer = setInterval(() => void count(), POLL_COUNT_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state, roomKey]);

  // The Jitsi script, once, from the configured server.
  useEffect(() => {
    if (jitsiConstructor()) {
      setScriptReady(true);
      return undefined;
    }
    let cancelled = false;
    loadJitsi()
      .then(() => {
        if (!cancelled) setScriptReady(true);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const leaveRoom = useCallback(() => {
    jitsiRef.current?.dispose();
    jitsiRef.current = null;
    setJoined(false);
  }, []);

  useEffect(() => leaveRoom, [leaveRoom]);

  const joinRoom = useCallback(
    (asHost: boolean) => {
      const Jitsi = jitsiConstructor();
      if (!live || !Jitsi || !containerRef.current) return;
      jitsiRef.current?.dispose();
      const displayName =
        account?.get('display_name') ?? account?.get('username') ?? 'Kronker';
      if (!JITSI_HOST) return;
      const jitsi = new Jitsi(JITSI_HOST, {
        roomName: live.room_key,
        parentNode: containerRef.current,
        userInfo: { displayName, email: '' },
        configOverwrite: {
          subject: live.title,
          disableDeepLinking: true,
          disableInviteFunctions: true,
          enableClosePage: false,
          // The host checks their input and devices before going in;
          // listeners go straight in.
          prejoinConfig: { enabled: asHost },
          prejoinPageEnabled: asHost,
          ...(asHost
            ? {
                startWithAudioMuted: false,
                startWithVideoMuted: true,
                // Music, not speech: no echo cancelling, noise
                // suppression, gain control or high-pass filter, and
                // stereo Opus at its top bitrate.
                disableAP: true,
                disableAEC: true,
                disableNS: true,
                disableAGC: true,
                disableHPF: true,
                stereo: true,
                opusMaxAverageBitrate: 510000,
                audioQuality: { stereo: true, opusMaxAverageBitrate: 510000 },
                toolbarButtons: [
                  'microphone',
                  'camera',
                  'desktop',
                  'chat',
                  'raisehand',
                  'reactions',
                  'participants-pane',
                  'tileview',
                  'fullscreen',
                  'settings',
                  'hangup',
                ],
              }
            : {
                startWithAudioMuted: true,
                startWithVideoMuted: true,
                toolbarButtons: [
                  'chat',
                  'raisehand',
                  'reactions',
                  'tileview',
                  'fullscreen',
                  'hangup',
                ],
              }),
        },
        interfaceConfigOverwrite: {
          SHOW_POWERED_BY: false,
          HIDE_INVITE_MORE_HEADER: true,
          DEFAULT_REMOTE_DISPLAY_NAME: 'Kronker',
        },
      });
      jitsi.addListener('readyToClose', leaveRoom);
      jitsiRef.current = jitsi;
      setJoined(true);
    },
    [live, account, leaveRoom],
  );

  const handleGoLive = useCallback(() => {
    if (!live) return;
    setBusy(true);
    void (async () => {
      try {
        const res = await api().post<BoothLive>(
          `/api/v1/booth_lives/${live.id}/start`,
        );
        setLive(res.data);
        let told = false;
        if (announce) {
          told = await api()
            .post(`/api/v1/booth_lives/${live.id}/share`, {
              visibility: announce,
            })
            .then(() => true)
            .catch(() => false);
        }
        dispatch(
          showAlert({ message: told ? messages.announced : messages.wentLive }),
        );
        joinRoom(true);
      } finally {
        setBusy(false);
      }
    })();
  }, [live, announce, dispatch, joinRoom]);

  const handleRejoin = useCallback(() => {
    joinRoom(true);
  }, [joinRoom]);
  const handleListen = useCallback(() => {
    joinRoom(false);
  }, [joinRoom]);

  const handleEnd = useCallback(() => {
    if (!live) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.endTitle),
        message: intl.formatMessage(messages.endBody),
        confirmLabel: intl.formatMessage(messages.endSet),
        destructive: true,
      });
      if (!ok) return;
      const res = await api().post<BoothLive>(
        `/api/v1/booth_lives/${live.id}/finish`,
      );
      leaveRoom();
      setLive(res.data);
    })();
  }, [live, confirm, intl, leaveRoom]);

  const handleRemove = useCallback(() => {
    if (!live) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.removeTitle),
        message: intl.formatMessage(messages.removeBody),
        confirmLabel: intl.formatMessage(messages.remove),
        destructive: true,
      });
      if (!ok) return;
      await api().delete(`/api/v1/booth_lives/${live.id}`);
      history.push('/hub/booth/live');
    })();
  }, [live, confirm, intl, history]);

  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }
  if (!live) {
    return <EmptyState title={intl.formatMessage(messages.notFound)} />;
  }

  const owner = live.is_owner;
  const startsAt = new Date(live.starts_at);
  const when =
    state === 'scheduled'
      ? startsAt > new Date()
        ? intl.formatMessage(messages.startsAt, {
            time: intl.formatDate(startsAt, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            }),
          })
        : intl.formatMessage(messages.startingSoon)
      : null;

  return (
    <>
      <KornerDetail
        className='booth-live'
        banner={
          state === 'live' ? (
            <span className='booth-live__badge'>
              {intl.formatMessage(messages.liveNow)}
            </span>
          ) : undefined
        }
        title={live.title}
        subtitle={
          <Link to={`/@${live.account.acct}`}>
            {intl.formatMessage(messages.host, {
              name: live.account.display_name || live.account.username,
            })}
          </Link>
        }
        meta={
          <KornerMeta
            items={[
              when,
              live.genres.length > 0 && live.genres.join(', '),
              state === 'live' && listeners !== null && (
                <FormattedMessage
                  key='listeners'
                  id='booth.live.listeners'
                  defaultMessage='{count, plural, one {# in the room} other {# in the room}}'
                  values={{ count: listeners }}
                />
              ),
            ]}
          />
        }
        actions={
          state !== 'ended' && (
            <KornerActionBar>
              {owner && state === 'scheduled' && (
                <KornerPill
                  variant='primary'
                  label={intl.formatMessage(messages.goLive)}
                  onClick={handleGoLive}
                  disabled={busy || !scriptReady}
                />
              )}
              {owner && state === 'live' && !joined && (
                <KornerPill
                  variant='primary'
                  label={intl.formatMessage(messages.rejoin)}
                  onClick={handleRejoin}
                  disabled={!scriptReady}
                />
              )}
              {owner && state === 'live' && (
                <KornerPill
                  variant='destructive'
                  label={intl.formatMessage(messages.endSet)}
                  onClick={handleEnd}
                />
              )}
              {owner && state === 'scheduled' && (
                <KornerPill
                  label={intl.formatMessage(messages.remove)}
                  onClick={handleRemove}
                />
              )}
              {!owner && state === 'live' && !joined && (
                <KornerPill
                  variant='primary'
                  label={intl.formatMessage(messages.listen)}
                  onClick={handleListen}
                  disabled={!scriptReady}
                />
              )}
              <RemindButton live={live} onChange={setLive} />
              {!owner && joined && (
                <KornerPill
                  label={intl.formatMessage(messages.leave)}
                  onClick={leaveRoom}
                />
              )}
            </KornerActionBar>
          )
        }
      >
        {state === 'ended' && (
          <EmptyState
            title={intl.formatMessage(messages.ended)}
            body={intl.formatMessage(
              owner ? messages.endedOwner : messages.endedBody,
            )}
            action={
              owner ? (
                <Link to='/hub/booth/composer'>
                  {intl.formatMessage(messages.uploadRecording)}
                </Link>
              ) : (
                <Link to='/hub/booth'>
                  {intl.formatMessage(messages.backToMusik)}
                </Link>
              )
            }
          />
        )}

        {owner && state !== 'ended' && !joined && (
          <section className='booth-live__ready'>
            <h2 className='booth-set__section-title'>
              {intl.formatMessage(messages.readyTitle)}
            </h2>
            <ul>
              <li>{intl.formatMessage(messages.tipInput)}</li>
              <li>{intl.formatMessage(messages.tipComputer)}</li>
              <li>{intl.formatMessage(messages.tipHeadphones)}</li>
              <li>{intl.formatMessage(messages.tipRecord)}</li>
              <li>{intl.formatMessage(messages.tipSize)}</li>
            </ul>
          </section>
        )}

        {!owner && state === 'scheduled' && (
          <p className='booth-live__waiting'>
            {intl.formatMessage(messages.waiting)}
          </p>
        )}

        {live.description && (
          <p className='booth-set__description'>{live.description}</p>
        )}

        <div
          ref={containerRef}
          className='booth-live__stage'
          hidden={!joined}
        />
      </KornerDetail>

      {confirmDialog}

      <Helmet>
        <title>{`${live.title} — ${intl.formatMessage(messages.heading)}`}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </>
  );
};
