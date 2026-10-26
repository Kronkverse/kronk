import { useCallback } from 'react';

import { apiSearchAttachmentCandidates } from 'mastodon/api/attachments';
import { useAppHistory } from 'mastodon/components/router';
import { parseKonnectParam } from 'mastodon/hooks/useKonnect';

// useKonnectReturn — where Cancel goes from a composer opened from a record
// (`?konnect=<slug>:<id>`, the Konnect picker's New …; docs/design.md,
// Konnect). The person was on that record, so cancelling goes back to it,
// not to the space's directory.
//
//   const returnToSource = useKonnectReturn();
//   const closeComposer = useCallback(() => {
//     setComposerOpen(false);
//     if (returnToSource('/hub/cinema')) return;
//     if (autoOpenComposer) history.replace('/hub/cinema');
//   }, [...]);
//
// Opened from within Kronk, it goes back a step. Arrived at directly (a
// link, a reload), it opens the record's page, found by its id; if that
// can't be found, `fallback`. Returns false, doing nothing, when the
// composer wasn't opened from a record.

export const useKonnectReturn = (): ((fallback: string) => boolean) => {
  const history = useAppHistory();

  return useCallback(
    (fallback: string) => {
      const source = parseKonnectParam(history.location.search);
      if (!source) return false;

      if (history.location.state?.fromMastodon) {
        history.goBack();
        return true;
      }

      apiSearchAttachmentCandidates(source.slug, '', 1, false, source.id)
        .then((rows) => {
          history.replace(rows[0]?.url ?? fallback);
          return undefined;
        })
        .catch(() => {
          history.replace(fallback);
        });
      return true;
    },
    [history],
  );
};
