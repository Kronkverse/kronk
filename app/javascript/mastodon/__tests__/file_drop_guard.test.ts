// Guard: every file upload takes a drop (docs/design.md, Compose +
// confirmation), so drag and drop works wherever someone adds a photo, and a
// drop never falls through to the window-level handler that puts it in the
// main post box instead.
//
// It finds every raw `<input type='file'>` and fails unless its file takes
// drops one of the shared ways: inside a <ComposeShell> (the whole composer
// is a drop target), wrapped in <PhotoDropTarget>, through usePhotoDrop, or
// as a <PhotoDropZone>. The few that can't be seen to from their own file
// are listed below with the reason.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FRONTEND_ROOT = path.resolve(__dirname, '..');

// Inputs whose file doesn't show how they take a drop, and why they do.
const COVERED_ELSEWHERE = new Set([
  // Rendered inside Booth's composer, a <ComposeShell>.
  'features/booth/components/album_tracks_field.tsx',
  // Rendered inside the Wachuneed listing composers, each a <ComposeShell>.
  'features/wachuneed/listing_photo_field.tsx',
  // Camera and library buttons, not used by any page yet; whatever places
  // them gives them their drop.
  'components/media/media_pick_buttons.tsx',
  // The post box: the window-level drop in features/ui/index.jsx is its
  // drag and drop.
  'features/compose/components/upload_button.jsx',
  // The styleguide's demo of a file input.
  'features/styleguide/index.tsx',
]);

// The shared pieces themselves, where the raw input is meant to live.
const ALLOWED = new Set(['components/media/photo_drop_zone.tsx']);

const TAKES_DROPS = [
  '<ComposeShell',
  '<PhotoDropTarget',
  '<PhotoDropZone',
  'usePhotoDrop(',
];

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walk(p, out);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
      out.push(p);
    }
  }
  return out;
};

// A file input's own tag, from `<input` to its closing `/>` or `>`.
const fileInputTags = (text: string): string[] => {
  const tags: string[] = [];
  const re = /<input\b[^>]*?type=['"{]+file['"}]+[^>]*>/gs;
  for (const m of text.matchAll(re)) tags.push(m[0]);
  return tags;
};

const fileInputFiles = () =>
  walk(FRONTEND_ROOT)
    .map((f) => path.relative(FRONTEND_ROOT, f))
    .filter(
      (rel) =>
        fileInputTags(readFileSync(path.join(FRONTEND_ROOT, rel), 'utf8'))
          .length > 0,
    );

describe('file uploads take a drop', () => {
  it('has no file input without drag and drop', () => {
    const offenders = fileInputFiles().filter((rel) => {
      if (ALLOWED.has(rel) || COVERED_ELSEWHERE.has(rel)) return false;
      const text = readFileSync(path.join(FRONTEND_ROOT, rel), 'utf8');
      return !TAKES_DROPS.some((mark) => text.includes(mark));
    });
    expect(
      offenders,
      'Put the input inside <PhotoDropTarget> (or use <PhotoDropZone>) from mastodon/components/media',
    ).toEqual([]);
  });

  it('keeps the covered-elsewhere list to files that still have an input', () => {
    const current = new Set(fileInputFiles());
    const gone = [...COVERED_ELSEWHERE].filter((rel) => !current.has(rel));
    expect(
      gone,
      'These have no file input now: take them off the list',
    ).toEqual([]);
  });
});
