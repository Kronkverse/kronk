// Client-side wiring for Screen 2 of the signup revamp — the three-
// threshold ceremony. Attaches to the server-rendered form and
// choreographs the ring crossings per KRONK_SIGNUP.md §5.Screen 2.
//
// The ceremony is client-side and session-scoped until the single
// POST from the arrival Enter button. Crossings do four things
// simultaneously: ripple wash on the crossed ring, ring fade-out,
// cosmos scale to the next ring's size (or 3.6× on the final),
// starfield warp via `window.kronkVoid.trigger()`. `[data-depth]` on
// the section drives `core-glyph` + `core-halo` opacity brightening
// per level (see `_signup.scss`).
//
// A vow-panel switch runs alongside — the current vow slides out
// upward-fade, the next slides in from below. On the final crossing,
// the arrival panel replaces the vow.

import ready from '../mastodon/ready';

// Ring radii — matches the SVG (r=250,175,100). SCALES targets each
// depth: 1 keeps the outermost visible, 250/175 zooms so the second
// ring occupies the outer slot, 250/100 for the third, 3.6 flies past
// the third into the core on Enter.
const SCALES = [1, 250 / 175, 250 / 100, 3.6];
const VOW_SLIDE_MS = 380;

interface KronkVoid {
  trigger: () => void;
}
declare global {
  interface Window {
    kronkVoid?: KronkVoid;
  }
}

function warp() {
  window.kronkVoid?.trigger();
}

function attach(section: HTMLElement) {
  const cosmos = section.querySelector<SVGGElement>('#threshold-cosmos');
  const wash = section.querySelector<SVGCircleElement>('#threshold-wash');
  const form = section.querySelector<HTMLFormElement>('#threshold-form');
  const enterBtn = section.querySelector<HTMLButtonElement>('#threshold-enter');
  const arrival = section.querySelector<HTMLElement>('#threshold-arrival');
  if (!cosmos || !wash || !form || !enterBtn || !arrival) return;

  let depth = 0;

  const crossThreshold = (idx: number, vow: HTMLElement) => {
    const ring = section.querySelector<SVGGElement>(
      `.threshold-ring[data-t="${idx}"]`,
    );
    const next = section.querySelector<SVGGElement>(
      `.threshold-ring[data-t="${idx + 1}"]`,
    );
    if (!ring) return;

    // ripple on the ring being crossed
    const base = ring.querySelector<SVGCircleElement>('.threshold-ring__base');
    if (base) {
      const r = base.getAttribute('r') ?? '250';
      wash.setAttribute('r', r);
      wash.classList.remove('is-going');
      void wash.getBoundingClientRect();
      wash.classList.add('is-going');
    }

    ring.classList.remove('is-active');
    ring.classList.add('is-crossed');
    if (next) {
      next.classList.remove('is-locked');
      next.classList.add('is-active');
    }

    depth = idx;
    section.dataset.depth = String(depth);
    cosmos.style.transform = `scale(${String(SCALES[depth] ?? 1)})`;
    warp();

    vow.classList.add('is-out');
    window.setTimeout(() => {
      vow.classList.remove('is-on', 'is-out');
      const nextVow = section.querySelector<HTMLElement>(
        `.threshold-vow[data-v="${idx + 1}"]`,
      );
      if (nextVow) {
        nextVow.classList.add('is-on');
      } else {
        arrival.classList.add('is-on');
      }
    }, VOW_SLIDE_MS);
  };

  const vows = Array.from(
    section.querySelectorAll<HTMLElement>('.threshold-vow'),
  );

  vows.forEach((vow) => {
    const idx = Number(vow.dataset.v);
    const key = vow.dataset.k ?? '';
    const agree = vow.querySelector<HTMLElement>('.threshold-vow__agree');
    const cross = vow.querySelector<HTMLButtonElement>('.threshold-vow__cross');
    const toggle = vow.querySelector<HTMLButtonElement>(
      '.threshold-vow__more-toggle',
    );
    const more = vow.querySelector<HTMLElement>('.threshold-vow__more');
    const hidden = form.querySelector<HTMLInputElement>(
      `#threshold-vow-${key}`,
    );
    if (!agree || !cross || !toggle || !more || !hidden) return;

    const flip = () => {
      const on = agree.getAttribute('aria-checked') === 'true';
      agree.setAttribute('aria-checked', String(!on));
      cross.classList.toggle('is-armed', !on);
      cross.disabled = on;
      hidden.value = !on ? '1' : '0';
    };
    agree.addEventListener('click', flip);
    agree.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      }
    });

    toggle.addEventListener('click', () => {
      const open = more.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    cross.addEventListener('click', () => {
      if (cross.disabled) return;
      crossThreshold(idx, vow);
    });
  });

  // On submit, streak the field out one more time so the transition
  // to /hub feels continuous. The redirect happens server-side after
  // record_thresholds_crossing! — no client-side redirect.
  form.addEventListener('submit', () => {
    cosmos.style.transform = 'scale(9)';
    warp();
  });
}

void ready(() => {
  const section = document.getElementById('threshold-ceremony');
  if (!section) return;
  attach(section);
}).catch((e: unknown) => {
  throw e;
});
