import type { ReactNode } from 'react';

// Kronk 2.0 first-run walkthrough. Copy locked with Tal 2026-09-11 via
// the mock at talitamoss.info/files/uploads/kronk_walkthrough_mock.html.
//
// Each step names:
//   - `route`   — the runner navigates here (history.push) before
//                 anchoring the bubble. Match Kronk's real paths.
//   - `anchor`  — the value of `data-walkthrough-anchor` on the target.
//                 `null` = centred bubble, no anchor + no spotlight.
//   - `openZhMenu` — when true, the runner asks the Ж menu to open
//                 before the bubble shows and to close on advance
//                 (via state.walkthrough.currentIdx + a selector the
//                 menu reads in kronk_menu.tsx).
//
// Bodies render as ReactNode so the "Navigating Kronk" bubble can
// carry a bullet list. Keep them terse — the spec says one idea per
// bubble.

export interface WalkthroughStep {
  id: string;
  route: string;
  anchor: string | null;
  title: string;
  body: ReactNode;
  openZhMenu?: boolean;
}

export const INTRO_STEPS: WalkthroughStep[] = [
  {
    id: 'intro/welcome',
    route: '/home',
    anchor: null,
    title: 'Welcome to Kronk',
    body: 'No ads, no algorithms, just your people and a safe place to share.',
  },
  {
    id: 'intro/nav',
    route: '/home',
    anchor: 'nav-bar',
    title: 'Navigating Kronk',
    body: (
      <ul className='walkthrough-bubble__list'>
        <li>
          <strong>Profile</strong> — You and your Kronk.
        </li>
        <li>
          <strong>Home</strong> — The people and korners you follow show new
          content here, chronologically.
        </li>
        <li>
          <strong>Hub</strong> — Explore the korners of Kronk.
        </li>
        <li>
          <strong>Nudges</strong> — Notifications and messaging.
        </li>
      </ul>
    ),
  },
  {
    id: 'intro/home',
    route: '/home',
    anchor: 'nav-home',
    title: 'Your feed, your home',
    body: 'Everyone and everything on Kronk you follow, feeds through your timeline. Control what you want to see, and see nothing more.',
  },
  {
    id: 'intro/profile',
    route: '/me',
    anchor: 'nav-me',
    title: 'You and your Kronk',
    body: 'Choose how your world sees you, control who gets access to your life, and customise your experience with Kronk.',
  },
  {
    id: 'intro/hub',
    route: '/hub',
    anchor: 'nav-hub',
    title: 'Hub',
    body: "Explore the korners of Kronk, follow the ones you're interested in and suggest new ones if you don't find what you're looking for.",
  },
  {
    id: 'intro/nudges',
    route: '/nudges',
    anchor: 'nav-nudges',
    title: 'Nudges',
    body: 'Nudges is the home of communications. Notifications from across Kronk land here, while you can also message your mates and share content.',
  },
  {
    id: 'intro/zh',
    route: '/home',
    anchor: 'zh-menu',
    title: 'Ж',
    body: "Your mobile toolbelt. Create new posts, search across the Kronkverse and access settings, all tailored to whichever space you're in.",
    openZhMenu: true,
  },
  {
    id: 'intro/done',
    route: '/home',
    anchor: null,
    title: 'Kronk is all yours!',
    body: 'This is a shared place, held in commons by all who gather here. You are part of the very lifeblood of Kronk. You are welcome here. AWAWB.',
  },
];
