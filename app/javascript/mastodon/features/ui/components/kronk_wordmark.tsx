// Kronk wordmark, top-left in the app chrome. The five bundled unicode
// marks (Ӂ Я Ѻ Ɲ ₭, font in _fonts.scss) are rendered as INDIVIDUAL
// character spans — not one word/logo — so each glyph can later route to
// its own destination and one specific glyph can host an easter egg.
//
// For now the whole wordmark is a single link to the /kronk org space
// (spec §O; Rails-served, so a plain <a> full-navigates). Per-character
// click targets land in a later pass.

const GLYPHS = ['Ӂ', 'Я', 'Ѻ', 'Ɲ', '₭'];

export const KronkWordmark = () => (
  <a href='/kronk' className='kronk-wordmark' aria-label='Kronk'>
    {GLYPHS.map((glyph) => (
      <span key={glyph} className='kronk-wordmark__char' aria-hidden='true'>
        {glyph}
      </span>
    ))}
  </a>
);
