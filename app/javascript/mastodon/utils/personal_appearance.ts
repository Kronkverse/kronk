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
  fontDisplay?: string | null;
  fontBody?: string | null;
  uiScale?: string | null;
}

export function applyPersonalAppearance({
  accent,
  fontDisplay,
  fontBody,
  uiScale,
}: PersonalAppearance): void {
  const root = document.documentElement;

  if (accent) root.style.setProperty('--accent', accent);
  else root.style.removeProperty('--accent');

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
