import { useCallback, useState } from 'react';

import { importFetchedAccount } from 'mastodon/actions/importer';
import api from 'mastodon/api';
import { useAppDispatch } from 'mastodon/store';

// Save part of your own identity (display name, bio, avatar, cover) where
// it is shown on your profile while editing. One partial
// `update_credentials` per save; the result goes into the store, so every
// surface showing you refreshes.
//
// Not the updateAccount action: that force-writes discoverable/indexable
// (privacy) on every call, which editing your name must not touch.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const useSaveOwnProfile = () => {
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<SaveStatus>('idle');

  const save = useCallback(
    (fields: Record<string, string | Blob>) => {
      const data = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        data.append(key, value);
      });
      setStatus('saving');
      void api()
        .patch('/api/v1/accounts/update_credentials', data)
        .then((response) => {
          dispatch(importFetchedAccount(response.data));
          setStatus('saved');
          return undefined;
        })
        .catch(() => {
          setStatus('error');
        });
    },
    [dispatch],
  );

  return { status, save };
};
