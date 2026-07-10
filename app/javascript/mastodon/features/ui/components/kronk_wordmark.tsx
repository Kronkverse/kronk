// Kronk wordmark. Serves as the entry point to the /kronk/* org space
// per spec §O — clicking opens `About Kronk`. Placed top-left in the
// app chrome (Phase 12 nav-chrome redesign).
//
// The glyph string uses Kronk's bundled Ӂ Я Ѻ Ɲ ₭ unicode marks. Font
// bundling happens in _fonts.scss. `/kronk` is Rails-served (not the
// SPA), so a plain <a> triggers a full navigation.

export const KronkWordmark = () => (
  <a href='/kronk' className='kronk-wordmark' aria-label='Kronk'>
    <span aria-hidden='true'>ӁЯѺƝ₭</span>
  </a>
);
