import { Link } from 'react-router-dom';

// Kronk wordmark. Serves as the entry point to the /kronk/* org space
// per spec §O — clicking opens `About Kronk`. Placed top-left in the
// app chrome (Phase 12 nav-chrome redesign).
//
// The glyph string uses Kronk's bundled Ӂ Я Ѻ Ɲ ₭ unicode marks. Font
// bundling happens in _fonts.scss.

export const KronkWordmark = () => (
  <Link
    to='/kronk'
    className='kronk-wordmark'
    aria-label='Kronk'
  >
    <span aria-hidden='true'>ӁЯѺƝ₭</span>
  </Link>
);
