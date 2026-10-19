import { useCallback, useRef } from 'react';

// Settings pages save each change as it is made. Two quick changes used to
// race: the requests could reach the server in either order, and whichever
// reply came back last was put on screen, so a toggle could show (or keep)
// the value it had been changed away from. The queue sends one request at a
// time, so the server sees changes in the order they were made, and
// `isLatest` says whether a reply is still the newest one to apply. Each
// reply carries the whole settings group, so the newest one is the truth.
export function useSaveQueue() {
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const newest = useRef(0);

  return useCallback(<T>(request: () => Promise<T>) => {
    const ticket = ++newest.current;
    const done = tail.current.then(request);
    tail.current = done.catch(() => undefined);

    return { done, isLatest: () => ticket === newest.current };
  }, []);
}
