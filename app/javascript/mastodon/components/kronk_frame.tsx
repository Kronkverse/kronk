// KronkFrame — the foundational page layout for Kronk 2.0.
//
// The Frame is a CSS grid with named slots. Every page renders inside
// it: chrome (wordmark, HubSwitcher, korner sidebar) into the band
// slots, per-space content into the Stage cell.
//
// Full spec: docs/kronk_frame.md.
//
// This first landing wires the wrapper + Stage slot only — TopBand,
// SpaceNav, RightBand, BottomBand exist as slot components but are
// unused by ui/index.jsx yet (the existing chrome stays position:
// fixed for now). Later PRs migrate the fade bands and un-fix the
// individual chrome components into their slots.
import type { ReactNode } from 'react';

interface KronkFrameProps {
  children: ReactNode;
}

interface SlotProps {
  children?: ReactNode;
}

const KronkFrameRoot = ({ children }: KronkFrameProps) => (
  <div className='kronk-frame'>{children}</div>
);

const TopBand = ({ children }: SlotProps) => (
  <header className='kronk-frame__top-band'>{children}</header>
);

const SpaceNav = ({ children }: SlotProps) => (
  <aside className='kronk-frame__space-nav'>{children}</aside>
);

const Stage = ({ children }: SlotProps) => (
  <main className='kronk-frame__stage'>{children}</main>
);

const RightBand = ({ children }: SlotProps) => (
  <aside className='kronk-frame__right-band'>{children}</aside>
);

const BottomBand = ({ children }: SlotProps) => (
  <nav className='kronk-frame__bottom-band'>{children}</nav>
);

export const KronkFrame = Object.assign(KronkFrameRoot, {
  TopBand,
  SpaceNav,
  Stage,
  RightBand,
  BottomBand,
});
