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

import { apiRequestPost } from 'mastodon/api';
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

export const getCallPass = (kind: CallKind, id?: string): Promise<CallPass> =>
  apiRequestPost<CallPass>(
    'v1/calls/token',
    id === undefined ? { kind } : { kind, id },
  );

type Listener = (data?: unknown) => void;

export interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, listener: Listener) => void;
  removeListener?: (event: string, listener: Listener) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  getNumberOfParticipants: () => number;
  isAudioMuted?: () => Promise<boolean>;
  isVideoMuted?: () => Promise<boolean>;
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
  // Record is offered only on a server that knows who moderates and with
  // somewhere to keep the file (the pass's `recording`).
  canRecord: boolean;
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
  // A live set: no echo cancelling, noise suppression, gain control or
  // high-pass filter, and stereo Opus at its top bitrate, so music comes
  // through as music.
  music?: boolean;
  // A Booth listener: no keyboard shortcuts, so M doesn't unmute them.
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

const musicConfig = {
  disableAP: true,
  disableAEC: true,
  disableNS: true,
  disableAGC: true,
  disableHPF: true,
  stereo: true,
  opusMaxAverageBitrate: 510000,
  audioQuality: { stereo: true, opusMaxAverageBitrate: 510000 },
};

const fields = (data: unknown): Record<string, unknown> =>
  typeof data === 'object' && data !== null
    ? (data as Record<string, unknown>)
    : {};

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

  const api = new Jitsi(jitsiHost, {
    roomName: pass.room,
    jwt: pass.jwt ?? undefined,
    parentNode,
    width: '100%',
    height: '100%',
    userInfo: { displayName, avatarUrl },
    configOverwrite: {
      ...baseConfig,
      ...(prejoin
        ? { prejoinPageEnabled: true, prejoinConfig: { enabled: true } }
        : {}),
      ...(music ? musicConfig : {}),
      ...(listenOnly ? { disableShortcuts: true } : {}),
      ...(subject ? { subject } : {}),
      startWithAudioMuted: startAudioMuted,
      startWithVideoMuted: startVideoMuted,
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
    canRecord: pass.recording && pass.jwt !== null,
  };
  let localId: string | null = null;
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

  const handlers: Record<string, Listener> = {
    videoConferenceJoined: (data) => {
      const id = fields(data).id;
      localId = typeof id === 'string' ? id : null;
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
      if (mode === undefined || mode === 'file') update({ recording: !!on });
    },
    participantRoleChanged: (data) => {
      if (isMe(data)) update({ moderator: fields(data).role === 'moderator' });
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
    dispose: () => {
      listeners.clear();
      Object.entries(handlers).forEach(([event, handler]) => {
        api.removeListener?.(event, handler);
      });
      api.dispose();
    },
  };
}
