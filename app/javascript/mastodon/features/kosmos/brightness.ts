// A single scalar (0..1) the Kosmos canvas reads every rAF frame to
// modulate its peak alpha ceiling. Kept outside Redux and React state
// on purpose: this is transient render-loop input, not persistent user
// data, and re-rendering the canvas host on every tween tick would
// waste work. The Inflow veil (later) drives this via a tween.
//
// 0 = ambient (threshold-of-perception default; barely visible)
// 1 = reveal (the veil moment — sky ramps to its full ceiling)

let value = 0;

export const getKosmosBrightness = (): number => value;

export const setKosmosBrightness = (next: number): void => {
  value = Math.max(0, Math.min(1, next));
};
