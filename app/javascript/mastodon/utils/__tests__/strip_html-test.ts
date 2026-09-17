import { stripHtml, stripHtmlToLine } from '../strip_html';

describe('stripHtml', () => {
  it('returns the text a status was wrapping', () => {
    expect(stripHtml('<p>hello <strong>there</strong></p>')).toBe(
      'hello there',
    );
  });

  it('is empty for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  // The three below are what the `<[^>]*>` regex this replaced got wrong.

  it('decodes entities instead of leaving them raw', () => {
    expect(stripHtml('<p>caf&eacute; &amp; bar</p>')).toBe('café & bar');
  });

  it('keeps text containing angle brackets', () => {
    expect(stripHtml('<p>a &lt; b and c &gt; d</p>')).toBe('a < b and c > d');
  });

  it('does not swallow the rest of the post after a stray bracket', () => {
    expect(stripHtml('<p>2 &lt; 3 and the rest survives</p>')).toContain(
      'the rest survives',
    );
  });

  it('leaves out script contents rather than reading as source code', () => {
    expect(stripHtml('<p>safe</p><script>alert(1)</script>')).toBe('safe');
  });

  it('leaves out style contents', () => {
    expect(stripHtml('<style>.a{color:red}</style><p>safe</p>')).toBe('safe');
  });
});

describe('stripHtmlToLine', () => {
  it('collapses block markup to a single line', () => {
    expect(stripHtmlToLine('<p>one</p>\n<p>two</p>')).toBe('one two');
  });

  it('trims surrounding whitespace', () => {
    expect(stripHtmlToLine('<p>  padded  </p>')).toBe('padded');
  });
});
