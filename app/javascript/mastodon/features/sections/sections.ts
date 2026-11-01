// The four sections of Kronk (2.2.0, Tal 2026-11-01; docs/decisions.md):
// YOU, Share, Join and Explore, with Home in the middle. Directions
// relative to you: who you are, what goes out from you, people coming
// together, and what individuals share with the community.
//
// The five screens sit side by side in this order, and a sideways swipe
// on a phone moves between them (section_swipe.tsx). The app opens on
// Home, in the middle.
export const SCREENS = ['/me', '/share', '/home', '/explore', '/join'];

export type SectionKey = 'you' | 'share' | 'home' | 'explore' | 'join';

// What each korner is part of, until phases 2 to 4 move or dissolve
// them one by one. Share lists what you can make (in this order); Explore
// what individuals share, as collections; Join what people do together.
export const SHARE_KORNERS = [
  'moments',
  'art',
  'booth',
  'cinema',
  'kronikles',
  'karporn',
  'albutts',
  'wachuneed',
  'kuestions',
  'kalendar',
  'map',
];

export const EXPLORE_KORNERS = [
  'art',
  'booth',
  'cinema',
  'kronikles',
  'karporn',
  'albutts',
  'wachuneed',
  'kuestions',
];

export const JOIN_KORNERS = ['kalendar', 'map', 'huddle', 'inflow', 'kommons'];

const YOU_KORNERS = ['profile', 'settings', 'you', 'klot', 'kommunity'];

// Where a korner's space badge goes back to from its landing page, now
// the Hub has gone: the section it belongs to.
export const sectionOf = (slug: string): SectionKey => {
  if (YOU_KORNERS.includes(slug)) return 'you';
  if (slug === 'krew' || slug === 'freethedream') return 'join';
  if (JOIN_KORNERS.includes(slug)) return 'join';
  if (slug === 'rose' || slug === 'feed') return 'home';
  return 'explore';
};

export const SECTION_PATH: Record<SectionKey, string> = {
  you: '/me',
  share: '/share',
  home: '/home',
  explore: '/explore',
  join: '/join',
};

export const SECTION_NAME: Record<SectionKey, string> = {
  you: 'YOU',
  share: 'Share',
  home: 'Home',
  explore: 'Explore',
  join: 'Join',
};

// Korners no section names yet (Explore lists them under "Also on
// Kronk", so nothing the Hub used to reach is lost).
export const placed = new Set([
  ...SHARE_KORNERS,
  ...EXPLORE_KORNERS,
  ...JOIN_KORNERS,
  'moments',
  'krew',
  'freethedream',
  'hub',
  'feed',
  'profile',
  'settings',
  'nudges',
]);
