import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useHistory } from 'react-router-dom';

import { showAlert } from 'mastodon/actions/alerts';
import api from 'mastodon/api';
import { CallControls } from 'mastodon/components/call_controls';
import {
  CallRecordingList,
  useCallRecordings,
} from 'mastodon/components/call_recordings';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { useCallState } from 'mastodon/hooks/useCallState';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { jitsiRecording, me } from 'mastodon/initial_state';
import type { Call } from 'mastodon/jitsi';
import {
  createCall,
  getCallPass,
  getCallPresence,
  jitsiHost,
  loadJitsi,
} from 'mastodon/jitsi';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { crowdMessageText, trackMessageText } from '../crowd';
import type { BoothLive, BoothLiveMoment, BoothTrack } from '../types';

import {
  CrowdComposer,
  CrowdOverlay,
  NowPlayingForm,
  useCrowdOnScreen,
  useLiveMoments,
} from './live_crowd';
import { RemindButton } from './remind_button';

// A live set's room (docs/spaces/booth.md, Live sets), on Huddle's Jitsi
// server, with a pass from Kronk and Kronk's call controls
// (mastodon/jitsi.ts). The host gets a get-ready panel, then joins with
// Jitsi's audio processing off and stereo at a high bitrate, so music comes
// through as music and not as a voice call, and can record the set on the
// server. Listeners tap Listen in (browsers only play sound after a tap)
// and join to listen only, with a raised hand and the view to choose. The
// page polls the set while you wait, so Listen in appears when the host goes
// live, and asks the Jitsi server how many people are in the room, the way
// Huddle's lobby does.
//
// While it's live, the crowd is on screen (live_crowd.tsx): listeners'
// shoutouts, reactions and requests, and the host's Now playing, over the
// call for everyone, and sent into the call by the host's page for the
// recorder to draw (crowd.ts). Once it's over, a recording's audio comes
// back as a draft set for the host to publish.

const POLL_SET_MS = 20_000;
const POLL_COUNT_MS = 15_000;

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
  recordingReady: {
    id: 'booth.live.recording_ready',
    defaultMessage: 'Your recording is ready',
  },
  setReady: {
    id: 'booth.live.set_ready',
    defaultMessage: 'Your set is ready to publish',
  },
  setReadyBody: {
    id: 'booth.live.set_ready_body',
    defaultMessage:
      'Kronk made it from the recording, with your Now playing as its track list. Only you can see it until you publish it.',
  },
  setMaking: {
    id: 'booth.live.set_making',
    defaultMessage: 'Making your set from the recording',
  },
  setMakingBody: {
    id: 'booth.live.set_making_body',
    defaultMessage:
      'A long set takes a few minutes. You’ll get a nudge when it’s ready to publish.',
  },
  publishSet: {
    id: 'booth.live.publish_set',
    defaultMessage: 'Publish your set',
  },
  downloadVideo: {
    id: 'booth.live.download_video',
    defaultMessage: 'Download video',
  },
  nowPlaying: {
    id: 'booth.live.now_playing',
    defaultMessage: 'Now playing: {track}',
  },
  recordingReadyBody: {
    id: 'booth.live.recording_ready_body',
    defaultMessage:
      'Only you can see it. To publish it as a set, download it, then upload it: the upload takes a file from your device, so it can’t use the stored recording directly yet.',
  },
  downloadRecording: {
    id: 'booth.live.download_recording',
    defaultMessage: 'Download the recording',
  },
  joinFailed: {
    id: 'booth.live.join_failed',
    defaultMessage: 'Couldn’t get into the room just now. Try again.',
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
  goNote: {
    id: 'booth.live.go_note',
    defaultMessage: 'Nobody can listen in until you go live.',
  },
  goNoteJoined: {
    id: 'booth.live.go_note_joined',
    defaultMessage:
      'You’re in the room. Nobody can listen in until you go live.',
  },
  readyTitle: {
    id: 'booth.live.ready_title',
    defaultMessage: 'Before you go live',
  },
  tipInput: {
    id: 'booth.live.tip_input',
    defaultMessage:
      'Plug your mixer or audio interface into your computer by USB and use Chrome. When the room opens, pick it as your microphone, or under Sound input.',
  },
  tipMusic: {
    id: 'booth.live.tip_music',
    defaultMessage:
      'Music sound is on: the browser leaves your sound as it is, in stereo. Turn it off under the room when you talk for a while.',
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
  tipRecordServer: {
    id: 'booth.live.tip_record_server',
    defaultMessage:
      'To keep the set, press Record under the room. Everyone sees it is being recorded, and the file comes to you afterwards to publish as a set.',
  },
  tipSize: {
    id: 'booth.live.tip_size',
    defaultMessage: 'A room plays best to up to about 35 people.',
  },
  host: { id: 'booth.live.host', defaultMessage: 'Hosted by {name}' },
  // The controls under the room speak of a set, not a call.
  controls: { id: 'booth.live.controls', defaultMessage: 'Set controls' },
  leaveSet: { id: 'booth.live.leave', defaultMessage: 'Leave the set' },
  stepOut: {
    id: 'booth.live.step_out',
    defaultMessage: 'Step out of the room. The set stays live',
  },
  recordingHint: {
    id: 'booth.live.recording_hint',
    defaultMessage: 'This set is being recorded',
  },
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
  const [joinFailed, setJoinFailed] = useState(false);
  const [call, setCall] = useState<Call | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<Call | null>(null);
  const account = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  const state = live?.state;
  const isHost = live?.is_owner === true;
  const hostName = live
    ? live.account.display_name || live.account.username
    : '';
  const callState = useCallState(call);
  // What the host last marked as playing, from the poll or the set itself.
  const [playing, setPlaying] = useState<{ text: string; at: number } | null>(
    null,
  );
  const [crowd, showCrowd, crowdDone] = useCrowdOnScreen();

  // New moments: on screen for everyone, and into the call from the host's
  // page, for the recorder.
  const handleMoments = useCallback(
    (fresh: BoothLiveMoment[]) => {
      showCrowd(fresh);
      const track = [...fresh].reverse().find((m) => m.kind === 'track');
      if (track) setPlaying({ text: track.text, at: track.at_seconds });
      const active = callRef.current;
      if (isHost && active) {
        fresh.forEach((moment) => {
          active.broadcast(crowdMessageText(moment));
        });
      }
    },
    [showCrowd, isHost],
  );
  const addMoment = useLiveMoments(
    id,
    state === 'live' && joined,
    handleMoments,
  );

  // The set's own list, for someone who arrives mid-set.
  const tracks: BoothTrack[] = live?.tracklist ?? [];
  const lastTrack = tracks[tracks.length - 1];
  const fromSet = lastTrack
    ? {
        text: lastTrack.artist
          ? `${lastTrack.artist} – ${lastTrack.title}`
          : lastTrack.title,
        at: lastTrack.start_seconds ?? 0,
      }
    : null;
  const nowPlaying =
    playing && (!fromSet || playing.at >= fromSet.at) ? playing : fromSet;

  // When recording starts, the host's page says what's playing again, so
  // the recording has it on screen from the start.
  // Only when recording starts, not on every track (those go as they come),
  // so the message waits in a ref.
  const recordingNow = callState?.recording === true;
  const playingMessageRef = useRef<string | null>(null);
  useEffect(() => {
    playingMessageRef.current = nowPlaying
      ? trackMessageText(hostName, nowPlaying.text, nowPlaying.at)
      : null;
  });
  useEffect(() => {
    const message = playingMessageRef.current;
    if (recordingNow && isHost && call && message) call.broadcast(message);
  }, [recordingNow, isHost, call]);

  // The set's recording, once it's over, for its host to publish.
  const [recordings, forgetRecording] = useCallRecordings(
    'booth_live',
    id,
    state === 'ended' && live?.is_owner === true,
  );

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

  // Who's in the room, through Kronk (the Jitsi server answers only Kronk;
  // Huddle's lobby does the same).
  const roomKey = live?.room_key;
  useEffect(() => {
    if (state !== 'live' || !roomKey || !jitsiHost) return undefined;
    let cancelled = false;
    const count = async () => {
      try {
        const { count: people } = await getCallPresence('booth_live', id);
        if (!cancelled) setListeners(people);
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
  }, [state, roomKey, id]);

  // The Jitsi script, once, from the configured server.
  useEffect(() => {
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
    callRef.current?.dispose();
    callRef.current = null;
    setCall(null);
    setJoined(false);
  }, []);

  useEffect(() => leaveRoom, [leaveRoom]);

  // In with a pass for this set. The host picks their input on Jitsi's
  // pre-join screen and plays with audio processing off; listeners go
  // straight in, muted, with no mic, camera or screen in their controls.
  const joinRoom = useCallback(
    (asHost: boolean) => {
      if (!live) return;
      setJoinFailed(false);
      void getCallPass('booth_live', live.id)
        .then((pass) => {
          if (!containerRef.current) return undefined;
          callRef.current?.dispose();
          const created = createCall({
            parentNode: containerRef.current,
            pass,
            displayName:
              account?.get('display_name') ??
              account?.get('username') ??
              'Kronker',
            avatarUrl: account?.get('avatar'),
            subject: live.title,
            prejoin: asHost,
            music: asHost,
            listenOnly: !asHost,
            startAudioMuted: !asHost,
            startVideoMuted: true,
          });
          if (!created) {
            setJoinFailed(true);
            return undefined;
          }
          created.api.addListener('readyToClose', leaveRoom);
          callRef.current = created;
          setCall(created);
          setJoined(true);
          return undefined;
        })
        .catch(() => {
          setJoinFailed(true);
        });
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

  const latestRecording = recordings[0];
  const latestVideo = recordings.find((r) => r.media !== 'audio');
  const hasAudio = recordings.some((r) => r.media === 'audio');
  const handleDownloadRecording = useCallback(() => {
    // A signed URL that answers "save as", so the page stays put.
    if (latestRecording) window.location.assign(latestRecording.download_url);
  }, [latestRecording]);
  const handleDownloadVideo = useCallback(() => {
    if (latestVideo) window.location.assign(latestVideo.download_url);
  }, [latestVideo]);
  const draftSetId = live?.booth_set_id ?? null;
  const handlePublishSet = useCallback(() => {
    if (draftSetId) history.push(`/hub/booth/sets/${draftSetId}`);
  }, [draftSetId, history]);
  const handleUploadRecording = useCallback(() => {
    history.push('/hub/booth/composer');
  }, [history]);

  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }
  if (!live) {
    return <EmptyState title={intl.formatMessage(messages.notFound)} />;
  }

  const owner = isHost;
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
            </KornerActionBar>
          )
        }
      >
        {/* Go live sits on its own at the top of the room, not in the
            header's row of small actions, where a host in the room
            missed it. */}
        {owner && state === 'scheduled' && (
          <section className='booth-live__go'>
            <p className='booth-live__go-note'>
              {intl.formatMessage(
                joined ? messages.goNoteJoined : messages.goNote,
              )}
            </p>
            <KornerPill
              variant='primary'
              className='booth-live__go-button'
              label={intl.formatMessage(messages.goLive)}
              onClick={handleGoLive}
              disabled={busy || !scriptReady}
            />
          </section>
        )}

        {state === 'ended' && owner && draftSetId && (
          <EmptyState
            title={intl.formatMessage(messages.setReady)}
            body={intl.formatMessage(messages.setReadyBody)}
            action={
              <KornerActionBar align='center'>
                <KornerPill
                  variant='primary'
                  label={intl.formatMessage(messages.publishSet)}
                  onClick={handlePublishSet}
                />
                {latestVideo && (
                  <KornerPill
                    label={intl.formatMessage(messages.downloadVideo)}
                    onClick={handleDownloadVideo}
                  />
                )}
              </KornerActionBar>
            }
          />
        )}

        {state === 'ended' && owner && !draftSetId && hasAudio && (
          <EmptyState
            title={intl.formatMessage(messages.setMaking)}
            body={intl.formatMessage(messages.setMakingBody)}
            action={
              latestVideo && (
                <KornerActionBar align='center'>
                  <KornerPill
                    label={intl.formatMessage(messages.downloadVideo)}
                    onClick={handleDownloadVideo}
                  />
                </KornerActionBar>
              )
            }
          />
        )}

        {state === 'ended' &&
          owner &&
          !draftSetId &&
          !hasAudio &&
          latestRecording && (
            <EmptyState
              title={intl.formatMessage(messages.recordingReady)}
              body={intl.formatMessage(messages.recordingReadyBody)}
              action={
                <KornerActionBar align='center'>
                  <KornerPill
                    variant='primary'
                    label={intl.formatMessage(messages.downloadRecording)}
                    onClick={handleDownloadRecording}
                  />
                  <KornerPill
                    label={intl.formatMessage(messages.uploadRecording)}
                    onClick={handleUploadRecording}
                  />
                </KornerActionBar>
              }
            />
          )}

        {state === 'ended' && owner && (
          <CallRecordingList
            recordings={recordings}
            onRemoved={forgetRecording}
          />
        )}

        {state === 'ended' && !(owner && latestRecording) && (
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
              <li>{intl.formatMessage(messages.tipMusic)}</li>
              <li>{intl.formatMessage(messages.tipComputer)}</li>
              <li>{intl.formatMessage(messages.tipHeadphones)}</li>
              <li>
                {intl.formatMessage(
                  jitsiRecording
                    ? messages.tipRecordServer
                    : messages.tipRecord,
                )}
              </li>
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

        {joinFailed && (
          <p className='booth-live__waiting' role='alert'>
            {intl.formatMessage(messages.joinFailed)}
          </p>
        )}

        {state === 'live' && nowPlaying && (
          <p className='booth-live__now-playing'>
            {intl.formatMessage(messages.nowPlaying, {
              track: nowPlaying.text,
            })}
          </p>
        )}

        <div className='booth-live__screen' hidden={!joined}>
          <div ref={containerRef} className='booth-live__stage' />
          {state === 'live' && (
            <CrowdOverlay moments={crowd} onDone={crowdDone} />
          )}
        </div>
        {joined && (
          <CallControls
            call={call}
            onLeave={leaveRoom}
            leaveLabel={intl.formatMessage(
              owner ? messages.stepOut : messages.leaveSet,
            )}
            leaveIcon='logout'
            label={intl.formatMessage(messages.controls)}
            recordingHint={intl.formatMessage(messages.recordingHint)}
            listenOnly={!owner}
            inputPicker={owner}
          />
        )}
        {joined && state === 'live' && owner && (
          <NowPlayingForm liveId={live.id} onSent={addMoment} />
        )}
        {joined && state === 'live' && !owner && (
          <CrowdComposer
            liveId={live.id}
            hostName={hostName}
            onSent={addMoment}
          />
        )}
      </KornerDetail>

      {confirmDialog}

      <Helmet>
        <title>{`${live.title} — ${intl.formatMessage(messages.heading)}`}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </>
  );
};
