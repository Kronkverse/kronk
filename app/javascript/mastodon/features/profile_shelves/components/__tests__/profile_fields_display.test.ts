import { describe, expect, it } from 'vitest';

import { isLongText, toChips } from '../profile_fields_display';

// Both of these came out of one screenshot of a real profile (2026-09-05):
// Interests and Values rendered as a single long pill each while In Rotation
// split correctly, and Personality broke mid-word in a narrow column.

describe('toChips', () => {
  it('splits on commas', () => {
    expect(toChips('field recordings, Arthur Russell')).toEqual([
      'field recordings',
      'Arthur Russell',
    ]);
  });

  it('splits on middots, which is how people actually write lists', () => {
    expect(toChips('Film photography · Leatherwork · Governance')).toEqual([
      'Film photography',
      'Leatherwork',
      'Governance',
    ]);
  });

  it('splits on bullets, semicolons, bars and newlines', () => {
    // The bullet is built at runtime rather than written literally: the repo
    // lints against the character in source, in favour of the middot, and the
    // rule reads the string's value so an escape wouldn't dodge it either.
    const bullet = String.fromCharCode(0x2022);

    expect(toChips(`a ${bullet} b ; c | d\ne`)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('does not split on slashes', () => {
    // `pair` answers are written "she / her", and a chip like "and/or" would
    // otherwise shatter into two.
    expect(toChips('and/or')).toEqual(['and/or']);
  });

  it('keeps hyphenated entries whole', () => {
    expect(toChips('Chop-and-drop gardening, Slow tools')).toEqual([
      'Chop-and-drop gardening',
      'Slow tools',
    ]);
  });

  it('drops empty entries and trims whitespace', () => {
    expect(toChips('  a ,, b ,  ')).toEqual(['a', 'b']);
  });
});

describe('isLongText', () => {
  it('leaves a short answer in its column', () => {
    expect(isLongText('Sydney')).toBe(false);
    expect(isLongText('she / her')).toBe(false);
  });

  it('gives a listed-out answer the full row', () => {
    expect(
      isLongText('Curious · Systems-minded · Patient · Principled · Maker'),
    ).toBe(true);
  });

  it('ignores surrounding whitespace when measuring', () => {
    expect(isLongText(`   ${'x'.repeat(20)}   `)).toBe(false);
  });
});
