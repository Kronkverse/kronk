// Client-side wiring for Screen 1 of the signup revamp — the account
// form (see KRONK_SIGNUP.md §5.Screen 1). Attaches to the Rails-server-
// rendered form and adds:
//
//   * Debounced username availability check (~350ms) against
//     `/auth/username_available`. Advisory only — the submit path still
//     validates on the server.
//   * Live email + password validation with three-state hints (neutral,
//     invalid, satisfied). Hint text is read from `data-hint-*`
//     attributes so translations stay in the locale file.
//   * Four-segment password strength meter — length ≥ 8, length ≥ 14,
//     non-alphanumeric or whitespace, mixed letters + digits. Advisory
//     only; never blocks submission, never leaves the page.
//   * Avatar drop control — click, keyboard (Enter/Space), drag-and-
//     drop, preview via object URL.
//   * Password show/hide toggle.
//   * Continue button is disabled until username, email, and password
//     all validate client-side.
//
// No colour literals, no direct token reads. All styling comes from
// class swaps consumed by `_signup.scss`.

import ready from '../mastodon/ready';

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

const state: FieldState = { user: false, email: false, pass: false };

function setControl(
  control: HTMLElement,
  hint: HTMLElement,
  ok: boolean | null,
  message: string,
  hintClass: 'good' | 'bad' | null,
) {
  control.classList.toggle('is-bad', ok === false);
  control.classList.toggle('is-good', ok === true);
  hint.textContent = message;
  hint.className = 'signup-account__hint';
  if (hintClass) hint.classList.add(`signup-account__hint--${hintClass}`);
}

function gate(button: HTMLButtonElement) {
  button.disabled = !(state.user && state.email && state.pass);
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
        state.user = true;
        setControl(
          control,
          hint,
          true,
          hints.available.replace('%{username}', v),
          'good',
        );
      } else if (data.reason === 'taken') {
        state.user = false;
        setControl(
          control,
          hint,
          false,
          hints.taken.replace('%{username}', v),
          'bad',
        );
      } else if (data.reason === 'reserved') {
        state.user = false;
        setControl(control, hint, false, hints.reserved, 'bad');
      } else {
        state.user = false;
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
      state.user = false;
      setControl(control, hint, null, hints.neutral, null);
      gate(continueBtn);
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(v)) {
      state.user = false;
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
      state.email = false;
      setControl(control, hint, null, hints.neutral, null);
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      state.email = false;
      setControl(control, hint, false, hints.invalid, 'bad');
    } else {
      state.email = true;
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
      state.pass = false;
      setControl(control, hint, null, hints.neutral, null);
    } else if (v.length < MIN_PASSWORD) {
      state.pass = false;
      setControl(control, hint, false, hints.bad, 'bad');
    } else {
      state.pass = true;
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

function attachAvatar(root: HTMLFormElement) {
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
  // touch to avoid the "unused" lint on the form ref
  void root;
}

void ready(() => {
  const form = document.querySelector<HTMLFormElement>('form.signup-account');
  const continueBtn = document.getElementById(
    'signup-continue',
  ) as HTMLButtonElement | null;
  if (!form || !continueBtn) return;

  attachUsername(form, continueBtn);
  attachEmail(form, continueBtn);
  attachPassword(form, continueBtn);
  attachAvatar(form);
}).catch((e: unknown) => {
  throw e;
});
