// Slug → inline-SVG glyph, hand-drawn to match the Hub prototype
// (public/hub-arrangeable-preview.html, retired 2.0.0-alpha.204). The
// prototype's tile aesthetic depends on thin-stroke line-art glyphs
// rather than the filled Material icons the rest of the app uses via
// useKornerIcon — the shadows and gradients only read as "chunky
// tile" when the glyph inside is a line drawing, not a solid shape.
//
// Precedence: the manifest wins. If `manifest.icon.glyph_path` is
// present, KornerGlyph renders that verbatim. Otherwise it falls
// through to the built-in PATHS map keyed by slug (the prototype's
// hand-drawn set). The manifest override is the escape hatch for
// per-korner line-art evolutions without a code change.

import type { FC, SVGProps } from 'react';

import { useKorner } from 'mastodon/hooks/useKorner';

// Each entry is the inner path/shape markup — the wrapping <svg> comes
// from the KornerGlyph component so stroke settings stay uniform.
const PATHS: Record<string, string> = {
  krew: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M17 15.5a5.5 5.5 0 0 1 4.5 3.5"/>',
  groups:
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M17 15.5a5.5 5.5 0 0 1 4.5 3.5"/>',
  inflow:
    '<circle cx="12" cy="5" r="2.6"/><circle cx="5.5" cy="17" r="2.6"/><circle cx="18.5" cy="17" r="2.6"/><path d="M10.6 7.3 7 14M13.4 7.3 17 14M8.2 17.6h7.6"/>',
  kalendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  wachuneed:
    '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 11h18"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
  kommons:
    '<path d="M14 13l-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="M9.5 6.5l8 8M13 3l8 8M17.5 2.5l4 4"/>',
  kuestions:
    '<path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.2-1.5 2.4"/><circle cx="12" cy="18" r=".7" fill="currentColor" stroke="none"/>',
  nudges:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 21l3-4"/>',
  booth:
    '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="4.5" height="6" rx="1.6"/><rect x="17" y="14" width="4.5" height="6" rx="1.6"/>',
  feed: '<path d="M4 6h16M4 11h16M4 16h9"/>',
  huddle:
    '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10.5 21 7v10l-6-3.5z"/>',
  kompass:
    '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z"/>',
  moments:
    '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="3.6"/>',
  albutts:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-4 4 3 3-2.5 6 4.5"/>',
  klot: '<path d="M2 9c3-3 5 3 8 0s5 3 8 0M2 15c3-3 5 3 8 0s5 3 8 0"/>',
};

// Anything the prototype didn't cover — render the same dot the icon
// fallback uses, drawn as a stroke ring so it sits at the same visual
// weight as the other glyphs.
const FALLBACK_PATH = '<circle cx="12" cy="12" r="7"/>';

export const KornerGlyph: FC<{ slug: string } & SVGProps<SVGSVGElement>> = ({
  slug,
  ...svgProps
}) => {
  const manifest = useKorner(slug);
  const inner = manifest?.icon?.glyph_path ?? PATHS[slug] ?? FALLBACK_PATH;
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
      dangerouslySetInnerHTML={{ __html: inner }}
      {...svgProps}
    />
  );
};
