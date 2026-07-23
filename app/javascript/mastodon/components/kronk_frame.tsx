// KronkFrame — the foundational page layout for Kronk 2.0.
//
// The Frame is a CSS grid with named slots. Every page renders inside
// it: chrome (wordmark, HubSwitcher, korner sidebar) into the band
// slots, per-space content into the Stage cell.
//
// Full spec: docs/kronk_frame.md.
//
// All five slots (TopBand, SpaceNav, Stage, RightBand, BottomBand) are
// wired in ui/index.jsx. The inner chrome has been un-fixed into flow
// children, but the slot strips themselves are still position: fixed
// during the migration — see the "Current state" section of the spec.
// The per-page migration off classic <Column>/<ColumnHeader> and into
// the shared <Stage> is ongoing (only Kuestions so far).
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
