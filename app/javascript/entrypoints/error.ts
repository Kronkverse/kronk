// Entrypoint kept as a stub so `vite_typescript_tag 'error.ts'` in
// `app/views/layouts/error.html.haml` continues to resolve.
//
// Historically this bound `mouseenter`/`mouseleave` on the error-page
// image to swap between `/oops.gif` (animated Mastodon character) and
// `/oops.png` (static frame). Both files were retired 2026-08-07 when
// the elephant sweep replaced them with the static Kronk logo
// (`/kronk-logo.svg`), so there's no animation to swap between and
// nothing for this script to do.
export {};
