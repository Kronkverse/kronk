import { useEffect, useSyncExternalStore } from 'react';

// Where the space badge goes back to, said by the page. AutoSpaceBadge
// backs up the URL, so any deep page of a korner goes to the korner root.
// A korner whose pages nest deeper than the URL shows (a FreeTheDream
// fractal inside a gang inside an emergence, all `/p/:id`) has the page
// say what's one layer up instead, and the badge takes the page's parent
// and its name (Tal, 2026-10-19: back "should return to the previous
// layer, not all the way back"). That makes a second back chip on the
// page redundant.
//
// Registrations stack, so a page mounting before the last one unmounts
// (a route change) never leaves the badge pointing at the old parent.

export interface SpaceBack {
  href: string;
  label: string;
}

let stack: { token: number; back: SpaceBack }[] = [];
let nextToken = 1;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const current = () => stack[stack.length - 1]?.back ?? null;

// A page's parent, while it's mounted. Pass null when it has none (the
// badge then backs up the URL as usual).
export const useSpaceBack = (back: SpaceBack | null) => {
  const href = back?.href;
  const label = back?.label;

  useEffect(() => {
    if (!href || label === undefined) return;
    const token = nextToken++;
    stack = [...stack, { token, back: { href, label } }];
    emit();
    return () => {
      stack = stack.filter((entry) => entry.token !== token);
      emit();
    };
  }, [href, label]);
};

export const useSpaceBackTarget = () =>
  useSyncExternalStore(subscribe, current, current);
