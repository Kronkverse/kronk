// Kronk's calls on its Jitsi server: the Main Huddle, Kuddles and the
// Booth's live sets (docs/decisions.md, 2026-10-27, "Kronk's own Jitsi").
// One place for the server, its script, the pass, the embed's settings and
// the call's state, so every room behaves the same.
//
//   getCallPass(kind, id)  asks Kronk for a pass: the Jitsi room name and,
//                          on a server that takes tokens, the JWT.
//   createCall({...})      embeds the call in `parentNode` with Jitsi's own
//                          toolbar hidden; Kronk draws the controls
//                          (components/call_controls.tsx), driven by the
//                          Call this returns.
//
// The domain comes from the server's settings (`JITSI_DOMAIN`), and is used
// only if it is a bare host name (`meet.example.org`, optionally with a
// port): never anything that could change what a script URL means.

import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import { jitsiDomain, jitsiRoomPrefix } from 'mastodon/initial_state';

export const jitsiHost: string | null = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(
  jitsiDomain,
)
  ? jitsiDomain
  : null;

// Jitsi's name for a room Kronk stores by `key` (JITSI_ROOM_PREFIX first).
// A pass already carries it; this is for asking the server who is in a room
// before joining.
export const jitsiRoomName = (key: string): string =>
  `${jitsiRoomPrefix}${key}`;

let jitsiScript: Promise<void> | null = null;

// Jitsi's external API script, loaded once per page however many rooms open.
export function loadJitsi(): Promise<void> {
  if (!jitsiHost) return Promise.reject(new Error('No Jitsi server'));
  if (jitsiConstructor()) return Promise.resolve();
  jitsiScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${jitsiHost}/external_api.js`;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      jitsiScript = null;
      script.remove();
      reject(new Error('Jitsi failed to load'));
    };
    document.head.appendChild(script);
  });
  return jitsiScript;
}

export type CallKind = 'huddle' | 'kuddle' | 'booth_live';

// POST /api/v1/calls/token. `jwt` is null on a server without tokens;
// `moderator` says the pass makes you one; `recording` says this Kronk can
// keep a recording.
export interface CallPass {
  domain: string;
  room: string;
  jwt: string | null;
  moderator: boolean;
  recording: boolean;
}

export interface CallPresence {
  names: string[] | null;
  count: number | null;
}

// Who is in a call before you join it. Kronk asks the Jitsi server, which
// answers only Kronk (Api::V1::Calls::PresencesController).
export const getCallPresence = (
  kind: CallKind,
  id?: string,
): Promise<CallPresence> =>
  apiRequestGet<CallPresence>(
    'v1/calls/presence',
    id === undefined ? { kind } : { kind, id },
  );

export const getCallPass = (kind: CallKind, id?: string): Promise<CallPass> =>
  apiRequestPost<CallPass>(
    'v1/calls/token',
    id === undefined ? { kind } : { kind, id },
  );

type Listener = (data?: unknown) => void;

// The External API's own methods Kronk uses. The optional ones are newer
// than some servers, so each is checked before it's called.
export interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, listener: Listener) => void;
  removeListener?: (event: string, listener: Listener) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  getNumberOfParticipants: () => number;
  isAudioMuted?: () => Promise<boolean>;
  isVideoMuted?: () => Promise<boolean>;
  // { audioInput: [{ deviceId, label, kind }], audioOutput, videoInput }
  getAvailableDevices?: () => Promise<unknown>;
  // { audioInput: { deviceId, label } | undefined, … }
  getCurrentDevices?: () => Promise<unknown>;
  setAudioInputDevice?: (label: string, deviceId: string) => void;
  // { rooms: [{ isMainRoom, participants: [{ id, role, displayName }] }] }
  getRoomsInfo?: () => Promise<unknown>;
}

// A microphone or sound card, as the call names it. The ids are the call's
// own: the call runs on the Jitsi server's origin, and browsers give each
// origin different device ids, so Kronk's page matches a device by label.
export interface AudioInput {
  deviceId: string;
  label: string;
}

type JitsiConstructor = new (
  domain: string,
  options: Record<string, unknown>,
) => JitsiApi;

const jitsiConstructor = (): JitsiConstructor | undefined =>
  (window as unknown as { JitsiMeetExternalAPI?: JitsiConstructor })
    .JitsiMeetExternalAPI;

// What Kronk's controls show, kept from the call's own events.
export interface CallState {
  audioMuted: boolean;
  videoMuted: boolean;
  sharing: boolean;
  handRaised: boolean;
  tileView: boolean;
  recording: boolean;
  moderator: boolean;
  // In the conference itself, past Jitsi's pre-join screen. A call that
  // starts something on joining (a live set's recording) waits for it.
  inConference: boolean;
  // When this page saw the recording start (ms), null while not recording.
  // Someone who joins a call already being recorded counts from joining.
  recordingSince: number | null;
  // Record is offered only on a server that knows who moderates and with
  // somewhere to keep the file (the pass's `recording`).
  canRecord: boolean;
  // A live set's host: whether Music sound is on (audio processing off).
  // Null in every other call, where there is no such switch.
  musicSound: boolean | null;
  // Goes up when the computer's devices change, so a picker lists again.
  devicesVersion: number;
}

export interface Call {
  api: JitsiApi;
  pass: CallPass;
  getState: () => CallState;
  subscribe: (listener: () => void) => () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleShareScreen: () => void;
  toggleRaiseHand: () => void;
  toggleTileView: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  // Music sound on (processing off) or off (voice processing back on).
  setMusicSound: (on: boolean) => void;
  // The input picker. `canPickInput` is false on a server whose API can't
  // list or change devices.
  canPickInput: boolean;
  getAudioInputs: () => Promise<AudioInput[]>;
  getCurrentAudioInput: () => Promise<AudioInput | null>;
  setAudioInput: (input: AudioInput) => void;
  // A text message to everyone in the call, the Jitsi server's page and its
  // recorder included (External API `sendEndpointTextMessage` with no
  // recipient, which broadcasts). The Booth's crowd on screen goes in this
  // way (features/booth/crowd.ts).
  broadcast: (text: string) => void;
  dispose: () => void;
}

export interface CreateCallOptions {
  parentNode: HTMLElement;
  pass: CallPass;
  displayName: string;
  avatarUrl?: string;
  subject?: string;
  startAudioMuted?: boolean;
  startVideoMuted?: boolean;
  // The Booth's host picks their mixer or interface on Jitsi's pre-join
  // screen; everyone else goes straight in.
  prejoin?: boolean;
  // A live set's host: no echo cancelling, noise suppression, gain control
  // or high-pass filter, and stereo Opus at its top bitrate, so music comes
  // through as music. Music sound in the controls turns the processing back
  // on for talking.
  music?: boolean;
  // A Booth listener: in to listen, not to be heard or seen (listenerConfig).
  listenOnly?: boolean;
}

// One configuration for every Kronk call. Jitsi draws the video; Kronk
// draws everything else.
const baseConfig = {
  toolbarButtons: [],
  prejoinPageEnabled: false,
  prejoinConfig: { enabled: false },
  disableDeepLinking: true,
  disableInviteFunctions: true,
  enableClosePage: false,
  hideConferenceTimer: true,
  readOnlyName: true,
  disableProfile: true,
  welcomePage: { disabled: true },
  localRecording: { disable: true },
  giphy: { enabled: false },
};

const baseInterfaceConfig = {
  TOOLBAR_BUTTONS: [],
  SHOW_JITSI_WATERMARK: false,
  SHOW_WATERMARK_FOR_GUESTS: false,
  SHOW_BRAND_WATERMARK: false,
  SHOW_POWERED_BY: false,
  HIDE_INVITE_MORE_HEADER: true,
  MOBILE_APP_PROMO: false,
  DEFAULT_REMOTE_DISPLAY_NAME: 'Kronker',
};

// The Booth's live sets only (docs/spaces/booth.md, Music sound). The keys
// are jitsi-meet's config.js keys, given through configOverwrite; a key a
// server doesn't know is ignored, so nothing here can break a call.
//
// Sound, for the host and listeners alike: stereo Opus at 510 kbps, Opus's
// ceiling (`audioQuality.stereo`, `audioQuality.opusMaxAverageBitrate`;
// `enableOpusDtx` off, so quiet passages aren't cut). Older servers read
// `stereo` and `opusMaxAverageBitrate` at the top level, so both are given.
// Listeners need stereo too: it is agreed per connection, both ways.
const LIVE_BITRATE = 510000;
const liveSoundConfig = {
  audioQuality: {
    stereo: true,
    opusMaxAverageBitrate: LIVE_BITRATE,
    enableOpusDtx: false,
  },
  stereo: true,
  opusMaxAverageBitrate: LIVE_BITRATE,
};

// The browser's voice processing, which treats music as noise to clean
// up: `disableAP` (all of it) and, one by one, `disableAEC` (echo
// cancelling), `disableNS` (noise suppression), `disableAGC` (gain control)
// and `disableHPF` (the high-pass filter). `music` true turns them all off.
const processingConfig = (music: boolean) => ({
  disableAP: music,
  disableAEC: music,
  disableNS: music,
  disableAGC: music,
  disableHPF: music,
  // "Your mic seems noisy" is wrong about a mixer.
  enableNoisyMicDetection: !music,
});

// How many people's video a listener's connection receives (`channelLastN`).
// Listeners send nothing, so the bridge's last-N, chosen by who speaks, is
// the host and whoever plays with them, and each listener costs the bridge
// one outgoing stream, not one per person in the room.
const LISTENER_LAST_N = 3;

// A Booth listener: no microphone or camera is opened at all
// (`disableInitialGUM`; `startWithAudioMuted`/`startWithVideoMuted` as well,
// for servers without it), no keyboard shortcuts (so M can't unmute), no
// tile of their own, no menu on other people's video, no audio levels
// worked out for a call they don't speak in, and video from the host's
// end only (`channelLastN`). The host's tile is pinned once the call says
// who moderates (`pinParticipant`), which asks the bridge for the host's
// video at its best.
const listenerConfig = {
  disableInitialGUM: true,
  startWithAudioMuted: true,
  startWithVideoMuted: true,
  disableShortcuts: true,
  disableSelfView: true,
  remoteVideoMenu: { disabled: true },
  disableAudioLevels: true,
  channelLastN: LISTENER_LAST_N,
};

// A live set's words (docs/spaces/booth.md, Live sets, The words). Jitsi
// talks of a meeting; a set isn't one. What config can change, it changes
// here: the pre-join screen names the set (`callDisplayName`, which Jitsi
// shows before the call has a subject, in place of the room's name), and
// Jitsi's own recording warning and "Record this meeting" are off, since
// the get-ready panel and Kronk's controls say it. Jitsi's own sentences
// ("Join meeting", "… joined the meeting") can't be overwritten from here:
// the Jitsi server fetches them from Kronk (Api::V1::Calls::BrandingsController).
const liveSetConfig = (subject: string | undefined) => ({
  ...(subject ? { callDisplayName: subject } : {}),
  recordings: { showPrejoinWarning: false, suggestRecording: false },
});

// The host's pre-join screen, without "Join without audio" or the phone
// dial-in: a set is played into the room.
const livePrejoinConfig = {
  prejoinPageEnabled: true,
  prejoinConfig: {
    enabled: true,
    hideExtraJoinButtons: ['no-audio', 'by-phone'],
  },
};

const fields = (data: unknown): Record<string, unknown> =>
  typeof data === 'object' && data !== null
    ? (data as Record<string, unknown>)
    : {};

const list = (data: unknown): unknown[] => (Array.isArray(data) ? data : []);

const toAudioInput = (data: unknown): AudioInput | null => {
  const { deviceId, label } = fields(data);
  return typeof deviceId === 'string' && typeof label === 'string'
    ? { deviceId, label }
    : null;
};

// Embeds a call. Null when the Jitsi script hasn't loaded or the server
// isn't a usable host.
export function createCall({
  parentNode,
  pass,
  displayName,
  avatarUrl,
  subject,
  startAudioMuted = false,
  startVideoMuted = false,
  prejoin = false,
  music = false,
  listenOnly = false,
}: CreateCallOptions): Call | null {
  const Jitsi = jitsiConstructor();
  if (!Jitsi || !jitsiHost) return null;
  // The host plays with music sound, everyone else listens: either way, a
  // Booth live set.
  const liveSet = music || listenOnly;

  const api = new Jitsi(jitsiHost, {
    roomName: pass.room,
    jwt: pass.jwt ?? undefined,
    parentNode,
    width: '100%',
    height: '100%',
    userInfo: { displayName, avatarUrl },
    configOverwrite: {
      ...baseConfig,
      ...(prejoin ? livePrejoinConfig : {}),
      ...(subject ? { subject } : {}),
      startWithAudioMuted: startAudioMuted,
      startWithVideoMuted: startVideoMuted,
      ...(liveSet ? liveSoundConfig : {}),
      ...(liveSet ? liveSetConfig(subject) : {}),
      ...(music ? processingConfig(true) : {}),
      ...(listenOnly ? listenerConfig : {}),
    },
    interfaceConfigOverwrite: baseInterfaceConfig,
  });

  let state: CallState = {
    audioMuted: startAudioMuted,
    videoMuted: startVideoMuted,
    sharing: false,
    handRaised: false,
    tileView: false,
    recording: false,
    moderator: pass.moderator,
    inConference: false,
    recordingSince: null,
    canRecord: pass.recording && pass.jwt !== null,
    musicSound: music ? true : null,
    devicesVersion: 0,
  };
  let localId: string | null = null;
  let pinnedId: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<CallState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => {
      listener();
    });
  };
  const isMe = (data: unknown) => {
    const id = fields(data).id;
    return typeof id === 'string' && id === localId;
  };

  // A listener's stage follows the host: pin whoever moderates.
  const pin = (id: string) => {
    if (!listenOnly || id === localId || id === pinnedId) return;
    pinnedId = id;
    api.executeCommand('pinParticipant', id);
  };
  const pinModerator = () => {
    if (!listenOnly || !api.getRoomsInfo) return;
    api
      .getRoomsInfo()
      .then((info) => {
        const people = list(fields(info).rooms).flatMap((room) =>
          list(fields(room).participants),
        );
        const host = people
          .map(fields)
          .find(
            (person) =>
              person.role === 'moderator' &&
              typeof person.id === 'string' &&
              person.id !== localId,
          );
        if (host && typeof host.id === 'string') pin(host.id);
        return undefined;
      })
      .catch(() => undefined);
  };

  // The microphone again, as it is, so a change to the processing applies
  // now: the browser applies it when an input is opened.
  const reopenMicrophone = () => {
    if (!api.getCurrentDevices || !api.setAudioInputDevice) return;
    api
      .getCurrentDevices()
      .then((devices) => {
        const input = toAudioInput(fields(devices).audioInput);
        if (input) api.setAudioInputDevice?.(input.label, input.deviceId);
        return undefined;
      })
      .catch(() => undefined);
  };

  const handlers: Record<string, Listener> = {
    videoConferenceJoined: (data) => {
      const id = fields(data).id;
      localId = typeof id === 'string' ? id : null;
      update({ inConference: true });
      pinModerator();
    },
    participantJoined: () => {
      if (pinnedId === null) pinModerator();
    },
    participantLeft: (data) => {
      if (fields(data).id === pinnedId) {
        pinnedId = null;
        pinModerator();
      }
    },
    deviceListChanged: () => {
      update({ devicesVersion: state.devicesVersion + 1 });
    },
    audioMuteStatusChanged: (data) => {
      update({ audioMuted: Boolean(fields(data).muted) });
    },
    videoMuteStatusChanged: (data) => {
      update({ videoMuted: Boolean(fields(data).muted) });
    },
    screenSharingStatusChanged: (data) => {
      update({ sharing: Boolean(fields(data).on) });
    },
    raiseHandUpdated: (data) => {
      // `handRaised` is when it went up, 0 once it's down.
      if (isMe(data)) update({ handRaised: Boolean(fields(data).handRaised) });
    },
    tileViewChanged: (data) => {
      update({ tileView: Boolean(fields(data).enabled) });
    },
    recordingStatusChanged: (data) => {
      const { on, mode } = fields(data);
      if (mode === undefined || mode === 'file') {
        update({
          recording: !!on,
          recordingSince: on ? (state.recordingSince ?? Date.now()) : null,
        });
      }
    },
    participantRoleChanged: (data) => {
      const { id, role } = fields(data);
      if (isMe(data)) update({ moderator: role === 'moderator' });
      else if (role === 'moderator' && typeof id === 'string') pin(id);
    },
  };
  Object.entries(handlers).forEach(([event, handler]) => {
    api.addListener(event, handler);
  });

  return {
    api,
    pass,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggleAudio: () => {
      api.executeCommand('toggleAudio');
    },
    toggleVideo: () => {
      api.executeCommand('toggleVideo');
    },
    toggleShareScreen: () => {
      api.executeCommand('toggleShareScreen');
    },
    toggleRaiseHand: () => {
      api.executeCommand('toggleRaiseHand');
    },
    toggleTileView: () => {
      api.executeCommand('toggleTileView');
    },
    startRecording: () => {
      api.executeCommand('startRecording', { mode: 'file' });
    },
    stopRecording: () => {
      api.executeCommand('stopRecording', 'file');
    },
    setMusicSound: (on) => {
      if (!music) return;
      // `overwriteConfig` changes the settings the call reads when it next
      // opens the microphone; reopening it applies them now. Stereo and the
      // bitrate stay as they are: they do a voice no harm.
      api.executeCommand('overwriteConfig', processingConfig(on));
      reopenMicrophone();
      update({ musicSound: on });
    },
    canPickInput: Boolean(api.getAvailableDevices && api.setAudioInputDevice),
    getAudioInputs: async () => {
      if (!api.getAvailableDevices) return [];
      const devices = await api.getAvailableDevices();
      return list(fields(devices).audioInput).flatMap((device) => {
        const input = toAudioInput(device);
        return input ? [input] : [];
      });
    },
    getCurrentAudioInput: async () => {
      if (!api.getCurrentDevices) return null;
      const devices = await api.getCurrentDevices();
      return toAudioInput(fields(devices).audioInput);
    },
    setAudioInput: (input) => {
      api.setAudioInputDevice?.(input.label, input.deviceId);
    },
    broadcast: (text) => {
      api.executeCommand('sendEndpointTextMessage', '', text);
    },
    dispose: () => {
      listeners.clear();
      Object.entries(handlers).forEach(([event, handler]) => {
        api.removeListener?.(event, handler);
      });
      api.dispose();
    },
  };
}
