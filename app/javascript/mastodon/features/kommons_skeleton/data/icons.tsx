// Glyphs for the Skeleton's discs, ported from the design prototype.
//
// A 24-grid line set drawn in `currentColor`, so a disc's glyph inherits
// whatever the emphasis tier has dimmed it to. Icon choice is the difference
// between a map you read and a map you recognise: at the zoom levels the
// camera settles on, the glyph is legible well before the label is.

import type { Tree } from './layout';

const PATHS: Record<string, React.ReactNode> = {
  feed: (
    <>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <ellipse cx="12" cy="12" rx="9" ry="4.2" />
      <ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(60 12 12)" />
    </>
  ),
  kommons: (
    <>
      <path d="M12 4v16M7 8h10M6 8l-2.5 5h5zM18 8l-2.5 5h5z" />
    </>
  ),
  booth: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13" width="4" height="6" rx="1.6" />
      <rect x="17" y="13" width="4" height="6" rx="1.6" />
    </>
  ),
  kalendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.4" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  huddle: (
    <>
      <circle cx="9" cy="9" r="2.6" />
      <circle cx="16.5" cy="10.5" r="2" />
      <path d="M4 19a5 5 0 0 1 10 0M14.5 19a4 4 0 0 1 5.5-3.7" />
    </>
  ),
  market: (
    <>
      <path d="M4 20V10M9.3 20V5M14.7 20v-8M20 20V8" />
    </>
  ),
  kompass: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M15.2 8.8 13.4 13.4 8.8 15.2l1.8-4.6z" />
    </>
  ),
  moments: (
    <>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="3.2 3.4" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  seeds: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c0-3.4-2.6-6-6-6 0 3.4 2.6 6 6 6zM12 14c0-3.9 3-7 7-7 0 3.9-3 7-7 7z" />
    </>
  ),
  tides: (
    <>
      <path d="M3 9c2.2-2.4 4.5-2.4 6.7 0s4.5 2.4 6.7 0 4.5-2.4 4.6 0M3 15c2.2-2.4 4.5-2.4 6.7 0s4.5 2.4 6.7 0 4.5-2.4 4.6 0" />
    </>
  ),
  albutts: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.4" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17l4.6-4.3 4 3.4 3-2.4 3.4 3" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="9.2" ry="5" transform="rotate(-28 12 12)" />
    </>
  ),
  kuestions: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5" />
      <circle cx="12" cy="16.6" r=".85" fill="currentColor" stroke="none" />
    </>
  ),
  inflow: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.6 12h16.8M12 3.6c2.2 2.4 3.4 5.3 3.4 8.4s-1.2 6-3.4 8.4c-2.2-2.4-3.4-5.3-3.4-8.4S9.8 6 12 3.6z" />
    </>
  ),
  nudges: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.6 5.4 1.6 5.4H4.9S6.5 14 6.5 10z" />
      <path d="M10.2 18.6a2 2 0 0 0 3.6 0" />
    </>
  ),
  page: (
    <>
      <path d="M6 3.6h7.5L18.5 9v11.4H6z" />
      <path d="M13.2 3.8V9h5" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20.2l1-4 11-11 3 3-11 11z" />
      <path d="M14.6 6.4l3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M15.4 15.4 20 20" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
    </>
  ),
  bug: (
    <>
      <rect x="7.5" y="8" width="9" height="11" rx="4.5" />
      <path d="M4.6 11h2.9M16.5 11h2.9M4.6 16h2.9M16.5 16h2.9M9.4 6l-1.3-2M14.6 6l1.3-2" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6-5.6-1.9 5.6-1.9z" />
    </>
  ),
  heart: (
    <>
      <path d="M12 19.6S4.4 15.3 4.4 10a4 4 0 0 1 7.6-1.8A4 4 0 0 1 19.6 10c0 5.3-7.6 9.6-7.6 9.6z" />
    </>
  ),};

export type IconName = keyof typeof PATHS;

export const Glyph: React.FC<{ name: string }> = ({ name }) => (
  <svg
    className='skel-ico'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.75'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    {PATHS[name] ?? PATHS.page}
  </svg>
);

// Resolved from what the registry already knows — a korner's slug, the shape
// of its URL — rather than from an icon field nobody maintains. A korner
// whose slug has a glyph gets it; its pages inherit it unless the URL says
// they do something more specific.
const URL_GLYPH: [RegExp, string][] = [
  [/\/(publish|compose)|\/edit$/, 'pen'],
  [/\/search/, 'search'],
  [/\/(followers|following|friendship)/, 'huddle'],
  [/\/media|\/gallery/, 'albutts'],
  [/\/settings/, 'pen'],
  [/\/public$|\/federated/, 'inflow'],
  [/\/notifications|\/nudges/, 'nudges'],
];

export const iconFor = (tree: Tree, id: string): string => {
  const node = tree[id];
  if (!node) return 'page';

  // The core and the three limbs are their own thing.
  if (id in PATHS) return id;

  const slug = node.korner ?? (node.parent ? tree[node.parent]?.korner : undefined);

  // A korner node itself always shows its own mark, never a URL guess.
  if (node.korner && node.korner in PATHS) return node.korner;

  if (node.url) {
    for (const [re, glyph] of URL_GLYPH) if (re.test(node.url)) return glyph;
  }

  if (slug && slug in PATHS) return slug;

  return 'page';
};
