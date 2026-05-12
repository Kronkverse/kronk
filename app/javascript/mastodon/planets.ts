export type PlanetName =
  | 'Sol'
  | 'Mercury'
  | 'Venus'
  | 'Earth'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto';

export const PLANET_COLORS: Record<PlanetName, string> = {
  Sol: '#9040C8',
  Mercury: '#6628C0',
  Venus: '#6A10D0',
  Earth: '#563ACC',
  Mars: '#422CA4',
  Jupiter: '#36248C',
  Saturn: '#4844C0',
  Uranus: '#3034A0',
  Neptune: '#343070',
  Pluto: '#1C1858',
};

// Which planet each space orbits
const SPACE_PLANET: Record<string, PlanetName> = {
  Feed: 'Mercury',
  Huddle: 'Venus',
  Market: 'Earth',
  Kommons: 'Jupiter',
  Kalendar: 'Neptune',
};

export function spaceColor(space: string): string {
  const planet = SPACE_PLANET[space];
  return planet !== undefined ? PLANET_COLORS[planet] : PLANET_COLORS.Earth;
}
