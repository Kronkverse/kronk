// ScopeMark — the concentric-ring glyph for one audience tier, read as a
// distance ladder from a tight self dot out to Kronk's wide ring. Shared across
// the scope carousel, the reach selector, and anywhere the audience ladder is
// drawn, so the whole system speaks one visual language. Extracted from the
// original ScopeCarousel prototype's mark() helper.

export type MarkKind = 'self' | 'mates' | 'orbit' | 'kronk' | 'krews';

interface Props {
  kind: MarkKind;
  size: number;
  className?: string;
}

export const ScopeMark: React.FC<Props> = ({ kind, size, className }) => {
  const c = size / 2;
  const bright = 'var(--kronk-purple-bright)';
  const mid = 'var(--kronk-purple-muted)';
  const dim = 'var(--text-muted)';
  const rings: React.ReactNode[] = [];

  const ring = (r: number, col: string, dash?: string, w = 1.25) => (
    <circle
      key={`r${rings.length}`}
      cx={c}
      cy={c}
      r={r}
      fill='none'
      stroke={col}
      strokeWidth={w}
      strokeDasharray={dash}
    />
  );
  const dot = (r: number, col: string) => (
    <circle key={`d${rings.length}`} cx={c} cy={c} r={r} fill={col} />
  );

  if (kind === 'self') {
    rings.push(dot(size * 0.1, bright), ring(size * 0.22, dim, '1 4'));
  } else if (kind === 'mates') {
    rings.push(
      dot(size * 0.09, bright),
      ring(size * 0.24, bright),
      ring(size * 0.4, dim, '1 5'),
    );
  } else if (kind === 'orbit') {
    rings.push(
      dot(size * 0.08, mid),
      ring(size * 0.2, mid),
      ring(size * 0.32, bright),
      ring(size * 0.44, dim, '1 5'),
    );
  } else if (kind === 'kronk') {
    rings.push(
      dot(size * 0.07, mid),
      ring(size * 0.18, mid),
      ring(size * 0.29, mid),
      ring(size * 0.42, bright, undefined, 1.6),
    );
  } else {
    // krews — three interlinked rings around a hub
    const r = size * 0.115;
    const d = size * 0.2;
    rings.push(
      <circle
        key='k1'
        cx={c}
        cy={c - d}
        r={r}
        fill='none'
        stroke={bright}
        strokeWidth={1.4}
      />,
      <circle
        key='k2'
        cx={c - d * 0.92}
        cy={c + d * 0.62}
        r={r}
        fill='none'
        stroke={bright}
        strokeWidth={1.4}
      />,
      <circle
        key='k3'
        cx={c + d * 0.92}
        cy={c + d * 0.62}
        r={r}
        fill='none'
        stroke={mid}
        strokeWidth={1.4}
      />,
      <circle key='k4' cx={c} cy={c} r={size * 0.03} fill={dim} />,
    );
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden='true'
    >
      {rings}
    </svg>
  );
};
