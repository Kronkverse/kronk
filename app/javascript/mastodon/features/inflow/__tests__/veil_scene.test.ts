import { act, renderHook } from '@testing-library/react';

import { useSkyDay } from '../veil_scene';

// The home feed can stay open for days on a phone; the veil must follow
// the day without a reload.
describe('useSkyDay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves on to the next day while the app stays open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T02:00:00Z'));

    const { result } = renderHook(() => useSkyDay());
    const first = result.current;

    act(() => {
      vi.setSystemTime(new Date('2026-11-10T02:00:00Z'));
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(result.current).not.toEqual(first);
  });

  it('catches up when the app comes back into view', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T02:00:00Z'));

    const { result } = renderHook(() => useSkyDay());
    const first = result.current;

    act(() => {
      vi.setSystemTime(new Date('2026-11-10T02:00:00Z'));
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current).not.toEqual(first);
  });
});
