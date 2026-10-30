import { useCallback, useEffect, useState } from 'react';

import type { ApiMapCountryNameJSON } from 'mastodon/api/map_country_names';
import {
  apiAddCountryName,
  apiGetCountryNames,
  apiRemoveCountryName,
} from 'mastodon/api/map_country_names';

// The open list of First Nations Country names (api/map_country_names.ts).
// One copy of the list for the visit, shared by the map and the profile
// fields, so a name added on one shows on the other.
let cache: ApiMapCountryNameJSON[] | null = null;
let loading = false;
const listeners = new Set<(names: ApiMapCountryNameJSON[]) => void>();

const publish = (names: ApiMapCountryNameJSON[]) => {
  cache = names;
  listeners.forEach((listener) => {
    listener(names);
  });
};

export const useCountryNames = () => {
  const [names, setNames] = useState<ApiMapCountryNameJSON[]>(cache ?? []);

  useEffect(() => {
    listeners.add(setNames);
    if (cache) setNames(cache);
    else if (!loading) {
      loading = true;
      void apiGetCountryNames()
        .then(publish)
        .catch(() => undefined)
        .finally(() => {
          loading = false;
        });
    }
    return () => {
      listeners.delete(setNames);
    };
  }, []);

  const add = useCallback(async (name: string, shapeId: number) => {
    const added = await apiAddCountryName(name, shapeId);
    publish([...(cache ?? []).filter((n) => n.id !== added.id), added]);
    return added;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiRemoveCountryName(id);
    publish((cache ?? []).filter((n) => n.id !== id));
  }, []);

  return { names, add, remove };
};
