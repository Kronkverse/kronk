import { useEffect } from 'react';

import { useHistory, useLocation } from 'react-router';

// Pages are reached by name (decisions.md, 2026-10-22). When one was opened
// by its old number or a name it had before a rename, put its current name
// in the address bar, without a new history entry. `param` is the URL
// segment the page was opened with.
export function useNamedLink(param: string, slug: string | undefined) {
  const history = useHistory();
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (!slug || param === slug) return;

    const segment = `/${encodeURIComponent(param)}`;
    const at = pathname.indexOf(segment);
    if (at < 0) return;

    history.replace({
      pathname: `${pathname.slice(0, at)}/${slug}${pathname.slice(at + segment.length)}`,
      search,
      hash,
    });
  }, [history, pathname, search, hash, param, slug]);
}
