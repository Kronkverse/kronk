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

const findOffenders = (): Offender[] => {
  const offenders: Offender[] = [];

  for (const file of walk(FRONTEND_ROOT)) {
    const src = readFileSync(file, 'utf8');
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
