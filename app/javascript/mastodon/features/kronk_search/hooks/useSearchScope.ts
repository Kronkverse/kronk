import { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

// Kronk Search contextual scope — infers the search scope from the
// current route. Per spec §"UX", the universal bar adapts:
//
//   /hub/kalendar/*    → events (kalendar korner scope)
//   /hub/kommons/*     → proposals
//   /hub/booth/*       → sets
//   /hub/marketplace/* → listings
//   /@:user/*          → that account's content
//   /home /hub /nudges → universal (no scope)
//
// The scope surfaces as a chip in the search UI; users can widen to
// universal with an explicit override.

export type SearchScope =
  | { kind: 'universal' }
  | { kind: 'korner'; slug: string }
  | { kind: 'account'; acct: string };

const KORNER_RE = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;
const ACCOUNT_RE = /^\/@([^/]+)(?:\/|$)/;

// Landing routes that carry no useful search scope.
const UNIVERSAL_ROUTES = new Set(['/home', '/hub', '/nudges', '/search']);

const inferScope = (pathname: string): SearchScope => {
  if (UNIVERSAL_ROUTES.has(pathname)) return { kind: 'universal' };

  // Capture groups are typed as possibly-undefined: a regex can match while a
  // group does not participate. These two always capture when they match, but
  // reading the group before checking it is the habit that bites elsewhere.
  const slug = KORNER_RE.exec(pathname)?.[1];
  if (slug) return { kind: 'korner', slug };

  const acct = ACCOUNT_RE.exec(pathname)?.[1];
  if (acct) return { kind: 'account', acct };

  return { kind: 'universal' };
};

export const useSearchScope = (): SearchScope => {
  const location = useLocation();
  return useMemo(() => inferScope(location.pathname), [location.pathname]);
};
