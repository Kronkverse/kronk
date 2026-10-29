import { useCallback, useId, useState } from 'react';

import type { MessageDescriptor } from 'react-intl';
import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import AppsIcon from '@/material-icons/400-24px/apps.svg?react';
import CallEndIcon from '@/material-icons/400-24px/call_end.svg?react';
import CancelPresentationIcon from '@/material-icons/400-24px/cancel_presentation.svg?react';
import DesktopMacIcon from '@/material-icons/400-24px/desktop_mac.svg?react';
import FitScreenIcon from '@/material-icons/400-24px/fit_screen.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import MicOffIcon from '@/material-icons/400-24px/mic_off.svg?react';
import MusicNoteIcon from '@/material-icons/400-24px/music_note.svg?react';
import RadioButtonCheckedIcon from '@/material-icons/400-24px/radio_button_checked.svg?react';
import StopIcon from '@/material-icons/400-24px/stop.svg?react';
import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import VideocamIcon from '@/material-icons/400-24px/videocam.svg?react';
import VideocamOffIcon from '@/material-icons/400-24px/videocam_off.svg?react';
import WavingHandIcon from '@/material-icons/400-24px/waving_hand.svg?react';
import { CallInputPanel } from 'mastodon/components/call_input_picker';
import { IconButton } from 'mastodon/components/icon_button';
import { useCallState } from 'mastodon/hooks/useCallState';
import type { Call, CallState } from 'mastodon/jitsi';

// Kronk's controls for a call (docs/decisions.md, 2026-10-27, "Kronk's own
// Jitsi"). Jitsi's toolbar is hidden; this bar drives the call through its
// API and shows what the call reports (mastodon/jitsi.ts). Used under every
// Kronk call: the Main Huddle and its mini window, Kuddles, Booth live sets.
//
// While the call is being recorded, everyone in it sees "Recording" at the
// start of the bar. Record / Stop recording is there only for a moderator,
// on a server that can keep the file. Leave is there from the start, before
// the call has come up (or if it never does).
//
// A live set's host also has Music sound (on by default: the browser's
// voice processing off; off for talking) and, with `inputPicker`, Sound
// input: which microphone or sound card the call uses, and its level
// (components/call_input_picker.tsx). Huddle and Kuddles have the picker
// too.

const messages = defineMessages({
  label: { id: 'calls.controls.label', defaultMessage: 'Call controls' },
  mute: { id: 'calls.controls.mute', defaultMessage: 'Mute' },
  unmute: { id: 'calls.controls.unmute', defaultMessage: 'Unmute' },
  cameraOff: {
    id: 'calls.controls.camera_off',
    defaultMessage: 'Turn camera off',
  },
  cameraOn: {
    id: 'calls.controls.camera_on',
    defaultMessage: 'Turn camera on',
  },
  share: {
    id: 'calls.controls.share_screen',
    defaultMessage: 'Share your screen',
  },
  stopSharing: {
    id: 'calls.controls.stop_sharing',
    defaultMessage: 'Stop sharing your screen',
  },
  raiseHand: { id: 'calls.controls.raise_hand', defaultMessage: 'Raise hand' },
  lowerHand: { id: 'calls.controls.lower_hand', defaultMessage: 'Lower hand' },
  tileView: { id: 'calls.controls.tile_view', defaultMessage: 'Show everyone' },
  speakerView: {
    id: 'calls.controls.speaker_view',
    defaultMessage: 'Show who’s speaking',
  },
  record: { id: 'calls.controls.record', defaultMessage: 'Record' },
  stopRecording: {
    id: 'calls.controls.stop_recording',
    defaultMessage: 'Stop recording',
  },
  leave: { id: 'calls.controls.leave', defaultMessage: 'Leave' },
  musicOn: {
    id: 'calls.controls.music_on',
    defaultMessage: 'Music sound is on. Turn it off for talking',
  },
  musicOff: {
    id: 'calls.controls.music_off',
    defaultMessage: 'Music sound is off. Turn it on for music',
  },
  input: { id: 'calls.controls.input', defaultMessage: 'Sound input' },
  recording: { id: 'calls.recording', defaultMessage: 'Recording' },
  recordingHint: {
    id: 'calls.recording_hint',
    defaultMessage: 'This call is being recorded',
  },
});

interface Props {
  call: Call | null;
  onLeave: () => void;
  // What Leave is called here ("Unhuddle" in the Huddle).
  leaveLabel?: string;
  // A Booth listener: hand, view and leave, no mic, camera or screen.
  listenOnly?: boolean;
  // Sound input: pick the microphone or sound card, and see its level.
  inputPicker?: boolean;
  // The mini window: smaller buttons that wrap.
  compact?: boolean;
  // Buttons of the page's own, after the call's (the mini window's way back
  // to the Huddle).
  children?: React.ReactNode;
}

// The call's own buttons, from what it reports.
const CallButtons: React.FC<{
  call: Call;
  state: CallState;
  listenOnly: boolean;
  // The Sound input button, and the panel it opens.
  input: { open: boolean; panelId: string; onToggle: () => void } | null;
}> = ({ call, state, listenOnly, input }) => {
  const intl = useIntl();
  // The label for a toggle: what pressing it does now.
  const label = (on: boolean, yes: MessageDescriptor, no: MessageDescriptor) =>
    intl.formatMessage(on ? yes : no);
  const musicSound = state.musicSound;
  const handleMusic = useCallback(() => {
    if (musicSound !== null) call.setMusicSound(!musicSound);
  }, [call, musicSound]);

  return (
    <>
      {!listenOnly && (
        <>
          <IconButton
            className={classNames('call-controls__button', {
              'call-controls__button--off': state.audioMuted,
            })}
            title={label(state.audioMuted, messages.unmute, messages.mute)}
            icon={state.audioMuted ? 'mic_off' : 'mic'}
            iconComponent={state.audioMuted ? MicOffIcon : MicIcon}
            onClick={call.toggleAudio}
          />
          <IconButton
            className={classNames('call-controls__button', {
              'call-controls__button--off': state.videoMuted,
            })}
            title={label(
              state.videoMuted,
              messages.cameraOn,
              messages.cameraOff,
            )}
            icon={state.videoMuted ? 'videocam_off' : 'videocam'}
            iconComponent={state.videoMuted ? VideocamOffIcon : VideocamIcon}
            onClick={call.toggleVideo}
          />
          <IconButton
            className='call-controls__button'
            active={state.sharing}
            title={label(state.sharing, messages.stopSharing, messages.share)}
            icon={state.sharing ? 'cancel_presentation' : 'desktop_mac'}
            iconComponent={
              state.sharing ? CancelPresentationIcon : DesktopMacIcon
            }
            onClick={call.toggleShareScreen}
          />
          {musicSound !== null && (
            <IconButton
              className='call-controls__button'
              active={musicSound}
              title={label(musicSound, messages.musicOn, messages.musicOff)}
              icon='music_note'
              iconComponent={MusicNoteIcon}
              onClick={handleMusic}
            />
          )}
          {input && (
            <IconButton
              className='call-controls__button'
              active={input.open}
              expanded={input.open}
              ariaControls={input.panelId}
              title={intl.formatMessage(messages.input)}
              icon='tune'
              iconComponent={TuneIcon}
              onClick={input.onToggle}
            />
          )}
        </>
      )}
      <IconButton
        className='call-controls__button'
        active={state.handRaised}
        title={label(state.handRaised, messages.lowerHand, messages.raiseHand)}
        icon='waving_hand'
        iconComponent={WavingHandIcon}
        onClick={call.toggleRaiseHand}
      />
      <IconButton
        className='call-controls__button'
        active={state.tileView}
        title={label(state.tileView, messages.speakerView, messages.tileView)}
        icon={state.tileView ? 'fit_screen' : 'apps'}
        iconComponent={state.tileView ? FitScreenIcon : AppsIcon}
        onClick={call.toggleTileView}
      />
      {state.canRecord && state.moderator && (
        <IconButton
          className={classNames('call-controls__button', {
            'call-controls__button--recording': state.recording,
          })}
          title={label(
            state.recording,
            messages.stopRecording,
            messages.record,
          )}
          icon={state.recording ? 'stop' : 'radio_button_checked'}
          iconComponent={state.recording ? StopIcon : RadioButtonCheckedIcon}
          onClick={state.recording ? call.stopRecording : call.startRecording}
        />
      )}
    </>
  );
};

export const CallControls: React.FC<Props> = ({
  call,
  onLeave,
  leaveLabel,
  listenOnly = false,
  inputPicker = false,
  compact = false,
  children,
}) => {
  const intl = useIntl();
  const state = useCallState(call);
  const leave = leaveLabel ?? intl.formatMessage(messages.leave);
  const panelId = useId();
  const [inputOpen, setInputOpen] = useState(false);
  const handleToggleInput = useCallback(() => {
    setInputOpen((open) => !open);
  }, []);
  const withInput = inputPicker && !listenOnly && !!call?.canPickInput;
  const input = withInput
    ? { open: inputOpen, panelId, onToggle: handleToggleInput }
    : null;

  return (
    <div
      className={classNames('call-controls', {
        'call-controls--compact': compact,
      })}
    >
      {state?.recording && (
        <span
          className='call-controls__recording'
          role='status'
          title={intl.formatMessage(messages.recordingHint)}
        >
          <span className='call-controls__recording-dot' aria-hidden='true' />
          {intl.formatMessage(messages.recording)}
        </span>
      )}

      <div
        className='call-controls__buttons'
        role='toolbar'
        aria-label={intl.formatMessage(messages.label)}
      >
        {call && state && (
          <CallButtons
            call={call}
            state={state}
            listenOnly={listenOnly}
            input={input}
          />
        )}
        {children}
        <IconButton
          className='call-controls__button call-controls__button--leave'
          title={leave}
          icon='call_end'
          iconComponent={CallEndIcon}
          onClick={onLeave}
        />
      </div>

      {call && state && withInput && inputOpen && (
        <CallInputPanel
          call={call}
          devicesVersion={state.devicesVersion}
          id={panelId}
        />
      )}
    </div>
  );
};
