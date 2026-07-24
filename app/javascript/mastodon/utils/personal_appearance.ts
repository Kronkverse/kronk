// Kronk Personal Appearance — applies a user's per-user token overrides as
// inline CSS custom properties on <html>, layered over the brand tokens.
// Inline `:root` styles win over any theme bundle's `:root{}` rule, so this
// works in the dark, light, and contrast bundles alike. The same function is
// called at boot (from main.tsx, reading initial_state) and by the settings
// panel for live preview.

export const DISPLAY_FONTS: Record<string, string> = {
  default: '',
  playfair: "'Playfair Display', Georgia, serif",
  fraunces: "'Fraunces', Georgia, serif",
  cormorant: "'Cormorant', Georgia, serif",
  lora: "'Lora', Georgia, serif",
  merriweather: "'Merriweather', Georgia, serif",
  garamond: "'EB Garamond', Georgia, serif",
  spectral: "'Spectral', Georgia, serif",
};

export const BODY_FONTS: Record<string, string> = {
  default: '',
  inter: "'Inter', system-ui, sans-serif",
  'ibm-plex': "'IBM Plex Sans', system-ui, sans-serif",
  manrope: "'Manrope', system-ui, sans-serif",
  'work-sans': "'Work Sans', system-ui, sans-serif",
  'dm-sans': "'DM Sans', system-ui, sans-serif",
  figtree: "'Figtree', system-ui, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export const UI_SCALE: Record<string, number> = {
  small: 0.9,
  default: 1,
  large: 1.1,
  xl: 1.2,
};

export interface PersonalAppearance {
  accent?: string | null;
  purpleHue?: number | null;
  fontDisplay?: string | null;
  fontBody?: string | null;
  uiScale?: string | null;
}

// Anchor lightness + chroma per --kronk-purple-* token, per theme. Kept in
// sync with the kronk: block in app/javascript/mastodon/tokens/tokens.yaml
// — the slider only swaps out the hue, so all five purples rotate together
// (whole family warms or cools as one). If tokens.yaml changes these L/C
// values, update this table too. There is no runtime source of truth for
// L/C on the client; the two must match by convention.
const PURPLE_FAMILY = {
  primary: { dark: { l: 32, c: 0.14 }, light: { l: 40, c: 0.14 } },
  bright: { dark: { l: 68, c: 0.2 }, light: { l: 62, c: 0.2 } },
  deep: { dark: { l: 30, c: 0.19 }, light: { l: 32, c: 0.19 } },
  muted: { dark: { l: 42, c: 0.06 }, light: { l: 55, c: 0.05 } },
  accent: { dark: { l: 50, c: 0.2 }, light: { l: 55, c: 0.19 } },
} as const;

type PurpleName = keyof typeof PURPLE_FAMILY;
const PURPLE_NAMES = Object.keys(PURPLE_FAMILY) as PurpleName[];

// Anchor hue in tokens.yaml. Sliding away from this shifts the whole
// palette warmer or cooler as a family.
export const DEFAULT_PURPLE_HUE = 285;
// The slider's range clamps to what still reads as "purple" (violet /
// indigo band). Below ~260 drifts into pure blue; above ~310 into
// magenta. Server enforces the same bounds.
export const MIN_PURPLE_HUE = 260;
export const MAX_PURPLE_HUE = 310;

function activeTheme(root: HTMLElement): 'dark' | 'light' {
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

// Write the five --kronk-purple-* overrides (and --accent, so the
// aliased consumer surfaces flip immediately). Passing `null` clears
// them so the base :root palette wins again.
function applyPurpleHue(root: HTMLElement, hue: number | null | undefined) {
  const theme = activeTheme(root);
  for (const name of PURPLE_NAMES) {
    const cssVar = `--kronk-purple-${name}`;
    if (hue == null) {
      root.style.removeProperty(cssVar);
      continue;
    }
    const { l, c } = PURPLE_FAMILY[name][theme];
    root.style.setProperty(cssVar, `oklch(${l}% ${c} ${hue})`);
  }

  // --accent aliases --semantic-accent (a hex value pinned at the
  // brand purple). Overriding --accent directly lets the slider drive
  // every accent site (CTAs, active pills, focus rings) without
  // touching the semantic layer.
  if (hue == null) {
    root.style.removeProperty('--accent');
  } else {
    const { l, c } = PURPLE_FAMILY.accent[theme];
    root.style.setProperty('--accent', `oklch(${l}% ${c} ${hue})`);
  }
}

export function applyPersonalAppearance({
  accent,
  purpleHue,
  fontDisplay,
  fontBody,
  uiScale,
}: PersonalAppearance): void {
  const root = document.documentElement;

  // Purple hue drives the whole --kronk-purple-* family + --accent.
  // Apply before the per-user accent override so an explicit accent
  // (from the older AccentWidget) still wins for the accent slot.
  applyPurpleHue(root, purpleHue);

  if (accent) root.style.setProperty('--accent', accent);
  else if (purpleHue == null) root.style.removeProperty('--accent');

  const disp = fontDisplay ? DISPLAY_FONTS[fontDisplay] : '';
  if (disp) root.style.setProperty('--font-display', disp);
  else root.style.removeProperty('--font-display');

  const body = fontBody ? BODY_FONTS[fontBody] : '';
  if (body) root.style.setProperty('--font-body', body);
  else root.style.removeProperty('--font-body');

  const scale = uiScale ? UI_SCALE[uiScale] : undefined;
  // `zoom` on <html> scales the whole interface reliably regardless of whether
  // individual tokens are px or rem. Use setProperty so we don't depend on the
  // typed `style.zoom` (absent in some TS DOM libs).
  if (scale && scale !== 1) root.style.setProperty('zoom', String(scale));
  else root.style.removeProperty('zoom');
}
