import { useMemo } from 'react';

// Kronk-purple star field behind the Kuestions shell. Matches the
// prototype's ambient star effect (a mix of ✦ glyphs and small dots).
// 90 elements is enough for a subtle field without visible tiling;
// positions are pseudo-random but stable within a session (useMemo).
const STAR_COUNT = 90;

interface Star {
  key: number;
  plus: boolean;
  size: number;
  left: number;
  top: number;
  opacity: number;
}

const makeStars = (): Star[] =>
  Array.from({ length: STAR_COUNT }, (_, i) => ({
    key: i,
    plus: Math.random() > 0.45,
    size: 7 + Math.random() * 6,
    left: Math.random() * 100,
    top: Math.random() * 100,
    opacity: 0.18 + Math.random() * 0.5,
  }));

export const StarsBackground: React.FC = () => {
  const stars = useMemo(makeStars, []);
  return (
    <div className='kuestions-stars' aria-hidden>
      {stars.map((s) =>
        s.plus ? (
          <span
            key={s.key}
            className='kuestions-stars__glyph'
            style={{
              fontSize: `${s.size}px`,
              left: `${s.left}%`,
              top: `${s.top}%`,
              opacity: s.opacity.toFixed(2),
            }}
          >
            ✦
          </span>
        ) : (
          <span
            key={s.key}
            className='kuestions-stars__dot'
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              opacity: s.opacity.toFixed(2),
            }}
          />
        ),
      )}
    </div>
  );
};
