import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import type { AudioInput, Call } from 'mastodon/jitsi';

// The sound input under a call (docs/spaces/booth.md, Music sound): which
// microphone or sound card the call uses, so a DJ mixer's or audio
// interface's USB sound card can be chosen, and how loud it is coming in.
//
// The list and the choice go through the call (External API
// getAvailableDevices / setAudioInputDevice). The level doesn't: the
// External API doesn't report the local microphone's level, so this page
// opens the same input itself (getUserMedia, processing off) and measures
// it with an AnalyserNode, only while the panel is open. The call runs on
// the Jitsi server's origin, and browsers give each origin its own device
// ids, so the input is found here by its label. The browser asks once for
// the microphone on Kronk's page too.

const messages = defineMessages({
  label: { id: 'calls.input.label', defaultMessage: 'Sound input' },
  unnamed: { id: 'calls.input.unnamed', defaultMessage: 'Input {number}' },
  none: { id: 'calls.input.none', defaultMessage: 'No inputs found' },
  hint: {
    id: 'calls.input.hint',
    defaultMessage:
      'Plugged in a mixer or audio interface by USB? Pick it here. Wear headphones.',
  },
  level: { id: 'calls.input.level', defaultMessage: 'Input level' },
  tooLoud: {
    id: 'calls.input.too_loud',
    defaultMessage: 'Too loud: turn your mixer’s output down a little.',
  },
  noLevel: {
    id: 'calls.input.no_level',
    defaultMessage: 'Allow the microphone for this page to see the level.',
  },
});

// Under this, a meter reads as silence (-60 dBFS).
const FLOOR_DB = -60;
// A peak this close to full scale is clipping.
const HOT = 0.98;
// A meter needs about a dozen readings a second, not one a frame.
const READ_EVERY_MS = 80;

const levelConstraints = (deviceId?: string): MediaStreamConstraints => ({
  audio: {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
});

const stopStream = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
};

// The peak level (0 to 1) of the input labelled `label`, or the default
// input when there's no label yet. `blocked` when the page can't open it.
const useInputLevel = (
  label: string | null,
): { peak: number; blocked: boolean } => {
  const [peak, setPeak] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frame = 0;

    const open = async () => {
      // The default input first: that asks for the microphone, and only
      // then does the browser give devices their labels.
      let opened =
        await navigator.mediaDevices.getUserMedia(levelConstraints());
      if (label) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const match = devices.find(
          (device) => device.kind === 'audioinput' && device.label === label,
        );
        const current = opened.getAudioTracks()[0]?.getSettings().deviceId;
        if (match && match.deviceId !== current) {
          stopStream(opened);
          opened = await navigator.mediaDevices.getUserMedia(
            levelConstraints(match.deviceId),
          );
        }
      }
      if (cancelled) {
        stopStream(opened);
        return;
      }

      stream = opened;
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(opened).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let last = 0;
      const read = (now: number) => {
        if (now - last >= READ_EVERY_MS) {
          last = now;
          analyser.getFloatTimeDomainData(samples);
          let loudest = 0;
          for (const sample of samples) {
            loudest = Math.max(loudest, Math.abs(sample));
          }
          setPeak(loudest);
        }
        frame = requestAnimationFrame(read);
      };
      frame = requestAnimationFrame(read);
      setBlocked(false);
    };

    open().catch(() => {
      if (!cancelled) setBlocked(true);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (stream) stopStream(stream);
      if (context) void context.close();
    };
  }, [label]);

  return { peak, blocked };
};

// 0 to 1 on a decibel scale, so quiet and loud both move the bar.
const meterFraction = (peak: number): number => {
  if (peak <= 0) return 0;
  const db = 20 * Math.log10(peak);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
};

export const CallInputPanel: React.FC<{
  call: Call;
  // Goes up when the computer's devices change (CallState.devicesVersion).
  devicesVersion: number;
  id: string;
}> = ({ call, devicesVersion, id }) => {
  const intl = useIntl();
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  const [current, setCurrent] = useState<AudioInput | null>(null);
  const { peak, blocked } = useInputLevel(current?.label ?? null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([call.getAudioInputs(), call.getCurrentAudioInput()])
      .then(([found, inUse]) => {
        if (cancelled) return undefined;
        setInputs(found);
        setCurrent(inUse ?? found[0] ?? null);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [call, devicesVersion]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const input = inputs.find((i) => i.deviceId === e.target.value);
      if (!input) return;
      call.setAudioInput(input);
      setCurrent(input);
    },
    [call, inputs],
  );

  const fraction = meterFraction(peak);
  const hot = peak >= HOT;

  return (
    <div className='call-controls__input' id={id}>
      <label className='call-controls__input-pick'>
        <span>{intl.formatMessage(messages.label)}</span>
        <select
          value={current?.deviceId ?? ''}
          onChange={handleChange}
          disabled={inputs.length === 0}
        >
          {inputs.length === 0 && (
            <option value=''>{intl.formatMessage(messages.none)}</option>
          )}
          {inputs.map((input, index) => (
            <option key={input.deviceId} value={input.deviceId}>
              {input.label ||
                intl.formatMessage(messages.unnamed, { number: index + 1 })}
            </option>
          ))}
        </select>
      </label>

      <div
        className={classNames('call-controls__level', {
          'call-controls__level--hot': hot,
        })}
        role='meter'
        aria-label={intl.formatMessage(messages.level)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
      >
        <span
          className='call-controls__level-bar'
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>

      {blocked ? (
        <p className='call-controls__input-hint'>
          {intl.formatMessage(messages.noLevel)}
        </p>
      ) : hot ? (
        <p className='call-controls__input-hint call-controls__input-hint--hot'>
          {intl.formatMessage(messages.tooLoud)}
        </p>
      ) : (
        <p className='call-controls__input-hint'>
          {intl.formatMessage(messages.hint)}
        </p>
      )}
    </div>
  );
};
