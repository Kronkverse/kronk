// Text overlays on a Moment — the Signal-Stories-style writing that
// sits *on* the image rather than beside it in the caption. Stored
// as JSONB on `moments.text_overlays` (see the migration + model),
// rendered here as positioned DOM so the source image stays clean
// and the text is screen-readable.
//
// Each overlay's `x` / `y` / `width` / `size` are normalised 0..1
// fractions of the media box, which makes the layout aspect-
// invariant — the same overlay renders correctly in the viewer's
// 3:4 stage, the composer's edit surface, or any future preview
// as long as the container is `position: relative`.
//
// This module is shared between the viewer's read-only render and
// the composer's editable render — the editor adds interaction on
// top of the same visual primitive so what-you-see-is-what-you-post.
//
// Structure (learned the hard way, 2026-08-06): positioning lives
// on a *wrapper* (OverlayPositioned in the read path, EditableOverlay
// in the editor), not on OverlayText itself. `<OverlayText>` used
// to be `position: absolute` with `max-width: N%` — inside an
// inline-block wrapper that had no explicit width, the % resolved
// against a 0-width parent and every character wrapped to its own
// line, making the text render *vertically*. Keeping OverlayText as
// pure inline-block styling (font, colour, backing, padding) means
// the wrapper controls sizing and the text just fills.

// The overlay's typographic family. Maps 1:1 to the Kronk font
// tokens (see `_tokens.scss`). Adding a font here is a two-step
// change: add the option in the composer's font swatches, add the
// var mapping in `.moments-overlay__text` in `_moments.scss`.
export type OverlayFont = 'display' | 'body' | 'mono';

// Behind-text visual — dark pill, light pill, accent pill, or bare
// text with a subtle stroke. Signal calls these `mode` styles.
export type OverlayBacking = 'none' | 'dark' | 'light' | 'accent';

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // 0..1 fraction from left of media box (centre of overlay)
  y: number; // 0..1 fraction from top of media box (centre of overlay)
  width: number; // 0..1 fraction of media box width (max wrap width)
  size: number; // 0..1 fraction of media box height (font size)
  rotation: number; // degrees; 0 = upright
  color: string; // CSS colour, expected `#hex`
  backing: OverlayBacking;
  font: OverlayFont;
}

// The colour palette the composer offers. Chosen to read well against
// arbitrary photo backgrounds — hard white / hard black are pinnable,
// the Kronk purple is the identity accent, the rest cover common
// mood/emphasis needs. Add cautiously: every colour here also has to
// be readable across the four backing modes.
export const OVERLAY_COLORS = [
  '#ffffff',
  '#111114',
  '#8f7fff', // --kronk-purple-bright
  '#ef4444', // --warning-red
  '#4b9160', // --success-green
  '#fbbf24', // amber, high-contrast on dark
  '#22d3ee', // cyan, high-contrast on warm
  '#ec4899', // pink
] as const;

// Backing style ↔ CSS class fragment. Keeps the render component
// pure — no conditional CSS building at the call site.
const BACKING_CLASS: Record<OverlayBacking, string> = {
  none: '',
  dark: ' moments-overlay__text--dark',
  light: ' moments-overlay__text--light',
  accent: ' moments-overlay__text--accent',
};

const FONT_VAR: Record<OverlayFont, string> = {
  display: 'var(--font-display)',
  body: 'var(--font-body)',
  mono: 'var(--font-mono)',
};

// Read-only render. Wraps each overlay in a positioned span so the
// text itself stays a plain inline-block; percentages on the wrapper
// resolve against the overlay layer (which has real width from its
// containing block), so wrapping happens at the right point.
export const OverlayLayer: React.FC<{
  overlays: TextOverlay[];
}> = ({ overlays }) => {
  if (overlays.length === 0) return null;
  return (
    <div className='moments-overlay-layer' aria-hidden={false}>
      {overlays.map((o) => (
        <OverlayPositioned key={o.id} overlay={o}>
          <OverlayText overlay={o} />
        </OverlayPositioned>
      ))}
    </div>
  );
};

// Positioning wrapper for one overlay. Owns `left/top/maxWidth/
// transform` — read-side only; the editor has its own equivalent
// wrapper that adds gesture handlers around the same shape.
export const OverlayPositioned: React.FC<{
  overlay: TextOverlay;
  children: React.ReactNode;
}> = ({ overlay, children }) => (
  <span className='moments-overlay-position' style={positionStyle(overlay)}>
    {children}
  </span>
);

// A single overlay's *visual* — the styled text span. NO positioning
// here; positioning lives on the wrapper. Making this static-flow
// means the wrapper's max-width resolves against a real containing
// block (the overlay layer), so text wraps at the right point rather
// than collapsing to zero-width and stacking vertically.
export const OverlayText: React.FC<{ overlay: TextOverlay }> = ({
  overlay,
}) => {
  const style: React.CSSProperties = {
    fontSize: `${(overlay.size * 100).toString()}cqh`,
    color: overlay.color,
    fontFamily: FONT_VAR[overlay.font],
  };
  return (
    <span
      className={`moments-overlay__text${BACKING_CLASS[overlay.backing]}`}
      style={style}
    >
      {overlay.text}
    </span>
  );
};

// The wrapper's positioning style, extracted so the editor's own
// positioning wrapper can reuse the same shape without duplicating
// the arithmetic.
export const positionStyle = (overlay: TextOverlay): React.CSSProperties => ({
  left: `${(overlay.x * 100).toString()}%`,
  top: `${(overlay.y * 100).toString()}%`,
  maxWidth: `${(overlay.width * 100).toString()}%`,
  transform: `translate(-50%, -50%) rotate(${overlay.rotation.toString()}deg)`,
});

// Convenience: default overlay for a "new text" tap. Placed at
// centre, medium width, sans-serif, white on dark pill (Signal's
// default). The composer clones this and immediately opens the
// text input.
export const newOverlay = (id: string): TextOverlay => ({
  id,
  text: '',
  x: 0.5,
  y: 0.5,
  width: 0.7,
  size: 0.06,
  rotation: 0,
  color: '#ffffff',
  backing: 'dark',
  font: 'body',
});
