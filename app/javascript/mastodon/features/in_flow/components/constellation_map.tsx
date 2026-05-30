// Simplified star map SVGs for the zodiacal constellations + Ophiuchus.
// Star positions are normalized 0–100 within a 100×60 viewBox.
// Each entry: stars (x,y,magnitude 1-3), lines ([starIndex, starIndex]).

interface Star {
  x: number;
  y: number;
  r?: number; // radius, default 1.5
}

interface ConstellationData {
  stars: Star[];
  lines: [number, number][];
}

const CONSTELLATION_DATA: Record<string, ConstellationData> = {
  Aries: {
    stars: [
      { x: 20, y: 38, r: 1.8 }, // Hamal
      { x: 38, y: 32, r: 1.4 },
      { x: 50, y: 28, r: 1.2 },
      { x: 62, y: 30, r: 1.0 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },
  Taurus: {
    stars: [
      { x: 55, y: 30, r: 2.2 }, // Aldebaran
      { x: 45, y: 40, r: 1.2 },
      { x: 38, y: 46, r: 1.0 },
      { x: 64, y: 22, r: 1.2 },
      { x: 72, y: 34, r: 1.0 },
      { x: 70, y: 44, r: 1.0 },
      { x: 20, y: 20, r: 1.4 }, // Pleiades region
      { x: 24, y: 16, r: 1.0 },
      { x: 17, y: 14, r: 1.0 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [0, 3],
      [3, 4],
      [4, 5],
      [0, 5],
    ],
  },
  Gemini: {
    stars: [
      { x: 28, y: 12, r: 1.8 }, // Castor
      { x: 38, y: 14, r: 2.0 }, // Pollux
      { x: 26, y: 28, r: 1.0 },
      { x: 36, y: 30, r: 1.0 },
      { x: 22, y: 42, r: 1.2 },
      { x: 32, y: 46, r: 1.0 },
      { x: 18, y: 54, r: 1.2 }, // Alhena region
      { x: 28, y: 56, r: 1.0 },
      { x: 50, y: 50, r: 1.2 },
    ],
    lines: [
      [0, 2],
      [2, 4],
      [4, 6],
      [1, 3],
      [3, 5],
      [5, 7],
      [6, 8],
      [7, 8],
    ],
  },
  Cancer: {
    stars: [
      { x: 30, y: 20, r: 1.0 },
      { x: 50, y: 28, r: 1.2 }, // Asellus Borealis
      { x: 50, y: 42, r: 1.2 }, // Asellus Australis
      { x: 72, y: 22, r: 1.0 },
      { x: 72, y: 48, r: 1.0 },
      { x: 50, y: 35, r: 1.8 }, // Beehive cluster hint
    ],
    lines: [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 4],
    ],
  },
  Leo: {
    stars: [
      { x: 72, y: 50, r: 2.2 }, // Regulus
      { x: 60, y: 36, r: 1.4 },
      { x: 44, y: 22, r: 1.6 }, // Algieba
      { x: 30, y: 16, r: 1.8 }, // Zosma / top of sickle
      { x: 20, y: 24, r: 1.2 },
      { x: 24, y: 38, r: 1.0 },
      { x: 38, y: 42, r: 1.0 },
      { x: 85, y: 30, r: 1.4 }, // Denebola
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 1],
      [0, 7],
    ],
  },
  Virgo: {
    stars: [
      { x: 62, y: 54, r: 2.4 }, // Spica
      { x: 50, y: 42, r: 1.4 },
      { x: 36, y: 32, r: 1.6 },
      { x: 24, y: 22, r: 1.2 },
      { x: 48, y: 22, r: 1.2 },
      { x: 66, y: 26, r: 1.4 }, // Porrima
      { x: 80, y: 34, r: 1.0 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [5, 6],
    ],
  },
  Libra: {
    stars: [
      { x: 30, y: 24, r: 1.6 }, // Zubenelgenubi
      { x: 55, y: 16, r: 1.4 }, // Zubeneschamali
      { x: 22, y: 44, r: 1.2 },
      { x: 48, y: 50, r: 1.0 },
      { x: 70, y: 40, r: 1.0 },
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
    ],
  },
  Scorpius: {
    stars: [
      { x: 12, y: 18, r: 1.0 },
      { x: 22, y: 20, r: 1.0 },
      { x: 32, y: 18, r: 1.0 },
      { x: 42, y: 22, r: 2.4 }, // Antares
      { x: 50, y: 28, r: 1.2 },
      { x: 58, y: 34, r: 1.2 },
      { x: 66, y: 42, r: 1.0 },
      { x: 72, y: 50, r: 1.0 },
      { x: 78, y: 55, r: 1.0 },
      { x: 84, y: 50, r: 1.2 }, // Shaula
      { x: 88, y: 44, r: 1.2 }, // stinger
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
    ],
  },
  Ophiuchus: {
    stars: [
      { x: 50, y: 10, r: 2.0 }, // Rasalhague
      { x: 26, y: 22, r: 1.2 },
      { x: 18, y: 40, r: 1.2 },
      { x: 22, y: 56, r: 1.0 },
      { x: 50, y: 58, r: 1.0 },
      { x: 78, y: 56, r: 1.0 },
      { x: 82, y: 40, r: 1.2 },
      { x: 74, y: 22, r: 1.2 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
    ],
  },
  Sagittarius: {
    stars: [
      { x: 38, y: 22, r: 1.0 }, // top of teapot
      { x: 50, y: 16, r: 1.0 }, // top handle
      { x: 60, y: 22, r: 1.2 },
      { x: 66, y: 34, r: 1.0 }, // handle
      { x: 62, y: 46, r: 1.2 }, // spout tip
      { x: 48, y: 50, r: 1.4 }, // base
      { x: 32, y: 46, r: 1.2 },
      { x: 28, y: 34, r: 1.2 }, // lid
      { x: 36, y: 28, r: 1.0 },
    ],
    lines: [
      [0, 8],
      [8, 7],
      [7, 6],
      [6, 5],
      [5, 4],
      [4, 3],
      [3, 2],
      [2, 1],
      [1, 0],
      [0, 5],
    ],
  },
  Capricornus: {
    stars: [
      { x: 14, y: 26, r: 1.4 }, // Algedi
      { x: 20, y: 24, r: 1.4 }, // Dabih
      { x: 38, y: 20, r: 1.0 },
      { x: 58, y: 22, r: 1.0 },
      { x: 80, y: 30, r: 1.2 },
      { x: 84, y: 44, r: 1.0 },
      { x: 70, y: 54, r: 1.0 },
      { x: 44, y: 52, r: 1.2 }, // Deneb Algedi
      { x: 24, y: 46, r: 1.0 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 1],
    ],
  },
  Aquarius: {
    stars: [
      { x: 36, y: 12, r: 1.6 }, // Sadalsuud
      { x: 46, y: 20, r: 1.4 },
      { x: 28, y: 22, r: 1.4 }, // Sadalmelik
      { x: 50, y: 30, r: 1.0 },
      { x: 60, y: 36, r: 1.0 },
      { x: 56, y: 46, r: 1.2 },
      { x: 40, y: 50, r: 1.0 },
      { x: 70, y: 54, r: 1.0 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [5, 7],
    ],
  },
  Pisces: {
    stars: [
      { x: 20, y: 28, r: 1.0 }, // Fish 1
      { x: 12, y: 20, r: 1.0 },
      { x: 14, y: 40, r: 1.0 },
      { x: 30, y: 44, r: 1.0 }, // knot
      { x: 44, y: 40, r: 1.2 },
      { x: 58, y: 38, r: 1.0 },
      { x: 70, y: 32, r: 1.0 }, // Fish 2
      { x: 80, y: 24, r: 1.0 },
      { x: 86, y: 36, r: 1.0 },
      { x: 80, y: 44, r: 1.0 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 6],
    ],
  },
};

interface ConstellationSVGProps {
  name: string;
  width?: number;
  height?: number;
}

export const ConstellationSVG: React.FC<ConstellationSVGProps> = ({
  name,
  width = 200,
  height = 120,
}) => {
  const data = CONSTELLATION_DATA[name];
  if (!data) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox='0 0 100 60'
      className='in-flow-constellation-svg'
      aria-label={`${name} star pattern`}
    >
      {/* Connection lines */}
      {data.lines.map(([a, b], i) => {
        const starA = data.stars[a];
        const starB = data.stars[b];
        if (!starA || !starB) return null;
        return (
          <line
            key={i}
            x1={starA.x}
            y1={starA.y}
            x2={starB.x}
            y2={starB.y}
            stroke='currentColor'
            strokeWidth='0.4'
            strokeOpacity='0.4'
          />
        );
      })}
      {/* Stars */}
      {data.stars.map((star, i) => (
        <circle
          key={i}
          cx={star.x}
          cy={star.y}
          r={star.r ?? 1.5}
          fill='currentColor'
          fillOpacity={star.r && star.r >= 2 ? 1 : 0.7}
        />
      ))}
    </svg>
  );
};
