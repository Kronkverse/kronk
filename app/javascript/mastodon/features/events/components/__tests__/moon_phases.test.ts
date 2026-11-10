import { getMoonSign, getNextMoonPhase } from '../celestial_calendar';

// Checked against the 2024 eclipses: the new moon of 8 April (18:21 UTC,
// 19 degrees Aries) and the full moon of 18 September (02:34 UTC, Pisces).
const MINUTE = 60 * 1000;

describe('getNextMoonPhase', () => {
  it('finds the next new moon to within a few minutes', () => {
    const when = getNextMoonPhase(new Date('2024-04-01T00:00:00Z'), 'new');
    const want = new Date('2024-04-08T18:21:00Z').getTime();
    expect(Math.abs(when.getTime() - want)).toBeLessThan(5 * MINUTE);
  });

  it('finds the next full moon to within a few minutes', () => {
    const when = getNextMoonPhase(new Date('2024-09-10T00:00:00Z'), 'full');
    const want = new Date('2024-09-18T02:34:00Z').getTime();
    expect(Math.abs(when.getTime() - want)).toBeLessThan(5 * MINUTE);
  });

  it('gives the one after, once a phase has passed', () => {
    const when = getNextMoonPhase(new Date('2024-04-08T19:00:00Z'), 'new');
    expect(when.toISOString().slice(0, 10)).toBe('2024-05-08');
  });
});

describe('getMoonSign', () => {
  it('reads the sign the moon is in', () => {
    expect(getMoonSign(new Date('2024-04-08T18:21:00Z'))).toBe('aries');
    expect(getMoonSign(new Date('2024-09-18T02:34:00Z'))).toBe('pisces');
  });
});
