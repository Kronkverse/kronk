// Kronk theme variant wiring.
//
// The design tokens (styles/mastodon/_tokens.scss) define their light values
// under `:root[data-theme='light']`. Nothing in the app ever set that
// attribute, so the light values never activated and the Kronk semantic
// surface/text tokens served their dark values under every theme — including
// the light skin. This derives the active variant from the theme the server
// applied (a `theme-*` class on <body>) — following `prefers-color-scheme` for
// the `system` theme — and stamps `data-theme` on <html>, so the light tokens
// turn on under the light skin (and the shade slider picks the right anchors,
// which it also reads from `data-theme`).

const LIGHT_QUERY = '(prefers-color-scheme: light)';

// Which server themes render light. `default` and `contrast` are dark; the
// `system` theme swaps bundles on prefers-color-scheme (ThemeHelper), so it is
// light only when the OS is.
function isLightTheme(): boolean {
  const { classList } = document.body;
  if (classList.contains('theme-mastodon-light')) return true;
  if (classList.contains('theme-system')) {
    return window.matchMedia(LIGHT_QUERY).matches;
  }
  return false;
}

function stampThemeVariant(): void {
  document.documentElement.dataset.theme = isLightTheme() ? 'light' : 'dark';
}

// Stamp the variant now, and — for the `system` theme, whose light/dark
// follows the OS — keep it in sync when the OS preference flips.
export function applyThemeVariant(): void {
  stampThemeVariant();

  if (document.body.classList.contains('theme-system')) {
    window
      .matchMedia(LIGHT_QUERY)
      .addEventListener('change', stampThemeVariant);
  }
}
