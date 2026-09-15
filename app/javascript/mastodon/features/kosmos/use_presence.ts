import { useEffect } from 'react';

import { getKosmosBrightness, setKosmosBrightness } from './brightness';

// Boost the Kosmos brightness knob while the caller is mounted, then
// restore the previous value on unmount. Used by pages whose whole
// aesthetic point IS the starfield behind them (meta hubs /me,
// /settings, /kronk) — the default brightness of 0 puts the layer at
// "threshold of perception" per the brief, which reads as invisible
// on empty stages. Boosting to ~0.4 lifts the peak alpha to ~0.56 so
// the starfield actually reads as starfield.
//
// The Inflow veil (`features/inflow/veil_scene.tsx`) sets brightness
// on its own schedule and ends its ramp at 0; if that runs while a
// hub is mounted, the hub's baseline is lost until the next mount.
// Rare interaction; accepted rather than fought.
export const useKosmosPresence = (target = 0.4): void => {
  useEffect(() => {
    const previous = getKosmosBrightness();
    setKosmosBrightness(target);
    return () => {
      setKosmosBrightness(previous);
    };
  }, [target]);
};
