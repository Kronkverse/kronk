// Unified signup entrypoint — coordinates the account form
// (Section 1) + threshold ceremony (Section 2) as one continuous
// page. Replaces the earlier split between `signup_account.ts` and
// `signup_thresholds.ts`, which lived on separate URLs and required
// the User to be created + signed in between them.
//
// Sections sit side-by-side inside `#signup-track`. The track
// translates on section change (chrome-scale slow ease). Section
// state is DOM-only; going "back" from thresholds preserves account
// fields with no server round-trip because the fields never left
// the DOM.
//
// On the final Enter (arrival button, type=submit), the browser
// submits the whole outer `#signup-form` — account fields + avatar
// (multipart) + three threshold acknowledgement hidden inputs — to
// `Auth::RegistrationsController#create`. The controller creates
// the User + Account with `thresholds_agreed_at` set in the SAME
// transaction. No "already signed in" trap, no pending state.

import ready from '../mastodon/ready';

// ────────────────────────────────────────────────────────────────
// Account form wiring (was: signup_account.ts).
// ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 350;
const MIN_PASSWORD = 8;
const STRONG_PASSWORD_SCORE = 3;

type Availability = 'invalid' | 'taken' | 'reserved' | null;

interface AvailabilityResponse {
  available: boolean;
  reason: Availability;
}

interface FieldState {
  user: boolean;
  email: boolean;
  pass: boolean;
}

const accountState: FieldState = { user: false, email: false, pass: false };

function setControl(
  control: HTMLElement,
  hint: HTMLElement,
  ok: boolean | null,
  message: string | null,
  hintClass: 'good' | 'bad' | null,
) {
  control.classList.toggle('is-bad', ok === false);
  control.classList.toggle('is-good', ok === true);
  hint.textContent = message;
  hint.className = 'signup-account__hint';
  if (hintClass) hint.classList.add(`signup-account__hint--${hintClass}`);
}

function gate(button: HTMLButtonElement) {
  button.disabled = !(
    accountState.user &&
    accountState.email &&
    accountState.pass
  );
}

function attachUsername(root: HTMLFormElement, continueBtn: HTMLButtonElement) {
  const input = root.querySelector<HTMLInputElement>(
    'input[name="user[account_attributes][username]"]',
  );
  const control = document.getElementById('signup-username-control');
  const hint = document.getElementById('signup-username-hint');
  if (!input || !control || !hint) return;

  const hints = {
    neutral: hint.textContent,
    invalid: input.dataset.hintInvalid ?? '',
    taken: input.dataset.hintTaken ?? '',
    reserved: input.dataset.hintReserved ?? '',
    available: input.dataset.hintAvailable ?? '',
  };

  let pending: number | null = null;
  let inflight: AbortController | null = null;

  const check = async (v: string) => {
    inflight?.abort();
    inflight = new AbortController();
    try {
      const resp = await fetch(
        `/auth/username_available?username=${encodeURIComponent(v)}`,
        { headers: { Accept: 'application/json' }, signal: inflight.signal },
      );
      if (!resp.ok) return;
      const data = (await resp.json()) as AvailabilityResponse;
      if (data.available) {
        accountState.user = true;
        setControl(
          control,
          hint,
          true,
          hints.available.replace('%{username}', v),
          'good',
        );
      } else if (data.reason === 'taken') {
        accountState.user = false;
        setControl(
          control,
          hint,
          false,
          hints.taken.replace('%{username}', v),
          'bad',
        );
      } else if (data.reason === 'reserved') {
        accountState.user = false;
        setControl(control, hint, false, hints.reserved, 'bad');
      } else {
        accountState.user = false;
        setControl(control, hint, false, hints.invalid, 'bad');
      }
      gate(continueBtn);
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      // network flake — leave the field neutral, server still validates.
    }
  };

  input.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value.trim().toLowerCase();
    (e.target as HTMLInputElement).value = v;
    if (pending !== null) window.clearTimeout(pending);
    if (!v) {
      accountState.user = false;
      setControl(control, hint, null, hints.neutral, null);
      gate(continueBtn);
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(v)) {
      accountState.user = false;
      setControl(control, hint, false, hints.invalid, 'bad');
      gate(continueBtn);
      return;
    }
    pending = window.setTimeout(() => void check(v), DEBOUNCE_MS);
  });
}

function attachEmail(root: HTMLFormElement, continueBtn: HTMLButtonElement) {
  const input = root.querySelector<HTMLInputElement>(
    'input[name="user[email]"]',
  );
  const control = document.getElementById('signup-email-control');
  const hint = document.getElementById('signup-email-hint');
  if (!input || !control || !hint) return;

  const hints = {
    neutral: hint.textContent,
    invalid: input.dataset.hintInvalid ?? '',
    good: input.dataset.hintGood ?? '',
  };

  input.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value.trim();
    if (!v) {
      accountState.email = false;
      setControl(control, hint, null, hints.neutral, null);
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      accountState.email = false;
      setControl(control, hint, false, hints.invalid, 'bad');
    } else {
      accountState.email = true;
      setControl(control, hint, true, hints.good, 'good');
    }
    gate(continueBtn);
  });
}

function attachPassword(root: HTMLFormElement, continueBtn: HTMLButtonElement) {
  const input = root.querySelector<HTMLInputElement>(
    'input[name="user[password]"]',
  );
  const control = document.getElementById('signup-password-control');
  const hint = document.getElementById('signup-password-hint');
  const meter = document.getElementById('signup-password-meter');
  const peek = document.getElementById(
    'signup-password-peek',
  ) as HTMLButtonElement | null;
  if (!input || !control || !hint || !meter || !peek) return;

  const hints = {
    neutral: hint.textContent,
    bad: input.dataset.hintBad ?? '',
    ok: input.dataset.hintOk ?? '',
    strong: input.dataset.hintStrong ?? '',
  };
  const peekLabels = {
    show: peek.dataset.labelShow ?? 'Show',
    hide: peek.dataset.labelHide ?? 'Hide',
  };

  const segments = Array.from(meter.children) as HTMLElement[];

  input.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value;
    let score = 0;
    if (v.length >= MIN_PASSWORD) score += 1;
    if (v.length >= 14) score += 1;
    if (/[^a-zA-Z0-9]/.test(v) || /\s/.test(v)) score += 1;
    if (/[0-9]/.test(v) && /[a-z]/i.test(v)) score += 1;
    segments.forEach((seg, i) => {
      seg.classList.toggle('is-on', i < score);
    });
    if (!v) {
      accountState.pass = false;
      setControl(control, hint, null, hints.neutral, null);
    } else if (v.length < MIN_PASSWORD) {
      accountState.pass = false;
      setControl(control, hint, false, hints.bad, 'bad');
    } else {
      accountState.pass = true;
      setControl(
        control,
        hint,
        true,
        score >= STRONG_PASSWORD_SCORE ? hints.strong : hints.ok,
        'good',
      );
    }
    gate(continueBtn);
  });

  peek.addEventListener('click', () => {
    const shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    peek.textContent = shown ? peekLabels.show : peekLabels.hide;
    peek.setAttribute('aria-label', shown ? peekLabels.show : peekLabels.hide);
  });
}

function attachAvatar() {
  const drop = document.getElementById('signup-avatar-drop');
  const fileInput = document.getElementById(
    'signup-avatar-input',
  ) as HTMLInputElement | null;
  const remove = document.getElementById(
    'signup-avatar-remove',
  ) as HTMLButtonElement | null;
  if (!drop || !fileInput || !remove) return;

  const load = (file: File) => {
    const url = URL.createObjectURL(file);
    drop.innerHTML = '';
    const img = document.createElement('img');
    img.alt = '';
    img.src = url;
    drop.appendChild(img);
    drop.classList.add('has-img');
    remove.hidden = false;
  };

  drop.addEventListener('click', () => {
    fileInput.click();
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  ['dragenter', 'dragover'].forEach((ev) => {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
    });
  });
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files[0];
    if (!f) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    fileInput.files = dt.files;
    load(f);
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) load(f);
  });
  remove.addEventListener('click', () => {
    drop.innerHTML = '<span class="signup-account__avatar-plus">+</span>';
    drop.classList.remove('has-img');
    fileInput.value = '';
    remove.hidden = true;
  });
}

// ────────────────────────────────────────────────────────────────
// Ceremony wiring (was: signup_thresholds.ts).
// ────────────────────────────────────────────────────────────────

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

function attachCeremony(
  form: HTMLFormElement,
  usernameInput: HTMLInputElement | null,
) {
  const section = document.getElementById('threshold-ceremony');
  if (!section) return;
  const cosmos = section.querySelector<SVGGElement>('#threshold-cosmos');
  const wash = section.querySelector<SVGCircleElement>('#threshold-wash');
  const enterBtn = section.querySelector<HTMLButtonElement>('#threshold-enter');
  const arrival = section.querySelector<HTMLElement>('#threshold-arrival');
  const arrivalHandle = section.querySelector<HTMLElement>(
    '#threshold-arrival-handle',
  );
  if (!cosmos || !wash || !enterBtn || !arrival) return;

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
        // Final crossing — inject the username into the arrival panel
        // greeting ("You're inside, @{username}. Take up space.").
        if (arrivalHandle && usernameInput) {
          arrivalHandle.textContent = `@${usernameInput.value.trim()}`;
        }
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
  // the User is created + threshold crossing recorded.
  form.addEventListener('submit', () => {
    cosmos.style.transform = 'scale(9)';
    warp();
  });
}

// ────────────────────────────────────────────────────────────────
// Section navigation — slide between account form and ceremony.
// ────────────────────────────────────────────────────────────────

type Section = 'account' | 'thresholds';

function attachSectionNav(track: HTMLElement, continueBtn: HTMLButtonElement) {
  const go = (target: Section) => {
    track.dataset.section = target;
    // Set focus to the first interactive element in the target
    // section so keyboard users don't get lost mid-slide.
    window.setTimeout(() => {
      const sec = track.querySelector<HTMLElement>(
        `.signup__section[data-section="${target}"]`,
      );
      const focusable = sec?.querySelector<HTMLElement>(
        'input:not([type=hidden]),button,[tabindex="0"],[role="checkbox"]',
      );
      focusable?.focus();
    }, 320);
  };

  continueBtn.addEventListener('click', (e) => {
    if (continueBtn.disabled) return;
    e.preventDefault();
    go('thresholds');
  });

  // Keyboard escape from ceremony → account (Esc rewinds one step).
  // Discoverable via aria-label on the section container in a follow-
  // up if needed; for now it's a power-user affordance.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (track.dataset.section !== 'thresholds') return;
    // Only rewind if no vow is mid-being-crossed (i.e. no ring is
    // between states). Simple heuristic: if the ceremony's depth
    // hasn't advanced yet, allow rewind.
    const section = document.getElementById('threshold-ceremony');
    if (section?.dataset.depth && Number(section.dataset.depth) > 0) return;
    go('account');
  });
}

// ────────────────────────────────────────────────────────────────
// Boot.
// ────────────────────────────────────────────────────────────────

void ready(() => {
  const form = document.querySelector<HTMLFormElement>('form#signup-form');
  const track = document.getElementById('signup-track');
  const continueBtn = document.getElementById(
    'signup-continue',
  ) as HTMLButtonElement | null;
  if (!form || !track || !continueBtn) return;

  const usernameInput = form.querySelector<HTMLInputElement>(
    'input[name="user[account_attributes][username]"]',
  );

  attachUsername(form, continueBtn);
  attachEmail(form, continueBtn);
  attachPassword(form, continueBtn);
  attachAvatar();
  attachCeremony(form, usernameInput);
  attachSectionNav(track, continueBtn);
}).catch((e: unknown) => {
  throw e;
});
