// Guard: every raw `<input type='file'>` in the frontend must be hidden so
// the browser's default "Choose files" button never renders (it ignores
// every Kronk token). The paired trigger — a `<label>`, styled span, or
// button.click() ref — is what the user sees and touches.
//
// This test walks the frontend, finds each `type='file'` occurrence, and
// asserts that ONE of the accepted hide-signals is present:
//
//   - the input itself has `hidden` or `style={{ display: 'none' }}`
//   - the input has `className='foo'` and some SCSS file sets `.foo { display: none }`
//   - the input is inside a `<label ... hidden` or `<label ... style={{ display: 'none' }}`
//
// Slipping a new raw file input in without hiding it → this test fails,
// with a pointer to the file:line. That's the "catch the next one" gate.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const STYLES_ROOT = path.resolve(FRONTEND_ROOT, '../styles');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walk(p, out);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
      out.push(p);
    }
  }
  return out;
};

const collectScss = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) collectScss(p, out);
    else if (entry.endsWith('.scss')) out.push(p);
  }
  return out;
};

const SCSS_TEXT = collectScss(STYLES_ROOT)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// Matches `display: none` sitting inside a class's block, even a nested
// one — e.g. `.parent { ... input { display: none } }`. Also matches BEM
// nesting via `&__leaf`.
const scssHidesClass = (className: string): boolean => {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // A. direct `.className { display: none }`
  const direct = new RegExp(
    `\\.${escaped}\\b[^{]*\\{[^}]*display:\\s*none`,
    'm',
  );
  if (direct.test(SCSS_TEXT)) return true;

  // B. BEM nesting — `.root { &__leaf { display: none } }`
  const bemMatch = /^([a-z0-9-]+)__([a-z0-9-]+)$/.exec(className);
  if (bemMatch) {
    const [, root, leaf] = bemMatch;
    const nested = new RegExp(
      `\\.${root}\\b[^]*?&__${leaf}\\b[^{]*\\{[^}]*display:\\s*none`,
      'm',
    );
    if (nested.test(SCSS_TEXT)) return true;
  }

  // C. wrapper class hides the input via a descendant rule:
  //    `.className { input { display: none } }` — or `input[type='file']`.
  //    Walk block-by-block so we don't overshoot the class's `}`.
  const blockRe = new RegExp(`\\.${escaped}\\b[^{]*\\{`, 'g');
  while (blockRe.exec(SCSS_TEXT) !== null) {
    let depth = 1;
    let i = blockRe.lastIndex;
    while (i < SCSS_TEXT.length && depth > 0) {
      const ch = SCSS_TEXT[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    const body = SCSS_TEXT.slice(blockRe.lastIndex, i - 1);
    if (/input\b[^{}]*\{[^}]*display:\s*none/s.test(body)) return true;
  }
  return false;
};

const inputRegex =
  /<input\b(?<attrs>[^>]*?\btype=(['"])file\2[^>]*?)\/?>|<input\b(?<attrsMulti>[^>]*?\btype=(['"])file\4[^>]*)>/gs;

interface Offender {
  file: string;
  line: number;
  snippet: string;
}

// Blank out comments before scanning, so the guard reads CODE only.
//
// Why: this check used to match the literal `<input type="file">` written
// inside a PROSE COMMENT — the doc comment in `features/me_hub/index.tsx`
// that explains the avatar upload flow — and report it as an offender,
// because a comment has no `className` to test against SCSS. The real
// input a few hundred lines below IS hidden
// (`.me-hub-avatar-preview__file-input { display: none }`), so the code was
// correct and the guard was wrong. A check that trips over its own
// documentation is permanently red, and a permanently red check catches
// nothing — it just gets ignored.
//
// Offsets are preserved (comment bytes become spaces, newlines kept) so the
// reported `file:line` still points at the true source line. String and
// template literals are copied verbatim, so a URL like 'https://…' is never
// mistaken for the start of a line comment.
const stripComments = (src: string): string => {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src.charAt(i);
    const next = src.charAt(i + 1);

    // `// …` to end of line
    if (ch === '/' && next === '/') {
      while (i < n && src.charAt(i) !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }

    // `/* … */`, which also covers JSX `{/* … */}`
    if (ch === '/' && next === '*') {
      let closed = false;
      while (i < n) {
        if (src.charAt(i) === '*' && src.charAt(i + 1) === '/') {
          out += '  ';
          i += 2;
          closed = true;
          break;
        }
        out += src.charAt(i) === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (!closed) break; // unterminated comment: nothing left that is code
      continue;
    }

    // string / template literal — copy through, honouring escapes
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < n) {
        if (src.charAt(i) === '\\') {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src.charAt(i);
        i += 1;
        if (src.charAt(i - 1) === quote) break;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
};

const findOffenders = (): Offender[] => {
  const offenders: Offender[] = [];

  for (const file of walk(FRONTEND_ROOT)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (!/type=(['"])file\1/.test(src)) continue;

    inputRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = inputRegex.exec(src)) !== null) {
      const attrs = match.groups?.attrs ?? match.groups?.attrsMulti ?? '';
      const before = src.slice(0, match.index);
      const line = before.split('\n').length;

      // A. `hidden` attribute on the input itself.
      if (/\bhidden(=\{true\}|=\{\}|\s|$|\/)/.test(attrs)) continue;

      // B. inline `style={{ display: 'none' }}` on the input.
      if (/style=\{\{[^}]*display:\s*['"]none['"]/.test(attrs)) continue;

      // C. `className` on the input maps to a SCSS `display: none` rule.
      const clsMatch = /className=(['"])([^'"]+)\1/.exec(attrs);
      const clsValue = clsMatch?.[2];
      if (clsValue) {
        const classes = clsValue.split(/\s+/).filter(Boolean);
        if (classes.some(scssHidesClass)) continue;
      }

      // D. wrapping element hides the input (window before match).
      const window = src.slice(Math.max(0, match.index - 600), match.index);
      if (
        /<label\b[^>]*\bhidden(\s|=|>)/.test(window) ||
        /<label\b[^>]*style=\{\{[^}]*display:\s*['"]none['"]/.test(window)
      ) {
        continue;
      }

      // E. an ancestor element's className maps to a SCSS rule that hides
      //    descendant inputs — matches `.wrapper { input { display: none } }`
      //    patterns used by Booth (.booth-upload-form__field) and Map
      //    (.map-logger__file).
      const wrapperClassMatches = window.matchAll(
        /className=(['"])([^'"]+)\1/g,
      );
      let hidden = false;
      for (const wc of wrapperClassMatches) {
        const wcClassValue = wc[2];
        if (!wcClassValue) continue;
        const wcClasses = wcClassValue.split(/\s+/).filter(Boolean);
        if (wcClasses.some(scssHidesClass)) {
          hidden = true;
          break;
        }
      }
      if (hidden) continue;

      offenders.push({
        file: path.relative(FRONTEND_ROOT, file),
        line,
        snippet: match[0].slice(0, 160),
      });
    }
  }

  return offenders;
};

describe('raw file inputs', () => {
  it('every <input type="file"> is hidden (no default browser button)', () => {
    const offenders = findOffenders();
    if (offenders.length > 0) {
      const lines = offenders
        .map(
          (o) => `  ${o.file}:${o.line}\n    ${o.snippet.replace(/\s+/g, ' ')}`,
        )
        .join('\n');
      throw new Error(
        `Found ${offenders.length} raw <input type="file"> renderer(s) — ` +
          `they show the browser's default "Choose files" button. Hide the ` +
          `input (SCSS \`display: none\`, inline style, or \`hidden\` attr) ` +
          `and drive the click from a styled sibling label or button ref. ` +
          `See app/javascript/mastodon/features/moments/composer.tsx for the ` +
          `established pattern.\n\n${lines}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});

// Covers the stripper directly, because the bug it fixes was invisible from
// the guard above: the guard simply reported a file:line that looked real.
describe('stripComments', () => {
  it('blanks a file input written inside a line comment', () => {
    const src =
      '// Upload flow: `<input type="file">` from the button\nconst a = 1;\n';

    expect(stripComments(src)).not.toMatch(/type="file"/);
  });

  it('blanks a file input inside a block or JSX comment', () => {
    expect(stripComments('/* <input type="file" /> */')).not.toMatch(
      /type="file"/,
    );
    expect(stripComments('{/* <input type="file" /> */}')).not.toMatch(
      /type="file"/,
    );
  });

  it('keeps real code, including a genuine file input', () => {
    const src = '<input type="file" className="x" />';

    expect(stripComments(src)).toBe(src);
  });

  // The reported file:line must stay truthful, so offsets cannot shift.
  it('preserves length and line numbering', () => {
    const src = '// comment\nconst a = 1;\n/* two\nlines */\nconst b = 2;\n';
    const stripped = stripComments(src);

    expect(stripped).toHaveLength(src.length);
    expect(stripped.split('\n')).toHaveLength(src.split('\n').length);
    expect(stripped.split('\n')[1]).toBe('const a = 1;');
  });

  // A URL inside a string must not be read as the start of a comment, or
  // everything after it on the line would be blanked.
  it('does not treat // inside a string as a comment', () => {
    const src = "const u = 'https://kronk.info/a';\nconst v = 2;\n";

    expect(stripComments(src)).toBe(src);
  });
});
