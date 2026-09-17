// Pure presentation: renders a horizontal strip of vertical bars
// scaled to normalized amplitude values in [0, 1]. Consumers own
// the amplitudes — this component makes no assumptions about how
// they were sampled or what they represent (live mic input, decoded
// audio, decorative sine, …). Used by VoiceRecorder (live mic +
// captured preview) and VoicePlayer (decorative or precomputed).

interface WaveformBarsProps {
  bars: number[];
  // Applies the `--live` modifier — colour + faster transition, for
  // live-microphone input under recording. Off by default.
  live?: boolean;
  // Fraction in [0, 1] indicating playback progress. Bars with an
  // index below this fraction render with the `--played` modifier.
  // Optional; playback-side consumers pass it, others don't.
  progress?: number;
  className?: string;
}

export const WaveformBars: React.FC<WaveformBarsProps> = ({
  bars,
  live,
  progress,
  className,
}) => {
  const total = bars.length;
  return (
    <div
      className={[
        'waveform-bars',
        live ? 'waveform-bars--live' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {bars.map((h, i) => {
        const played = progress !== undefined && i / total < progress;
        return (
          <span
            key={i}
            className={`waveform-bars__bar${played ? ' waveform-bars__bar--played' : ''}`}
            style={
              { '--bar-h': String(Math.max(0.06, h)) } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
};
