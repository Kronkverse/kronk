// Guard: photos go up through <PhotoDropZone> (components/media), so drag and
// drop works wherever someone adds a photo, and a drop never falls through
// to the window-level handler that puts it in the main post box instead
// (docs/design.md, Compose + confirmation).
//
// It finds every raw `<input type='file'>` whose accept list takes images
// and fails unless the file is on the burn-down list below. The list is the
// photo uploads that predate the rule; each comes off as it moves onto the
// drop zone. Nothing new goes on it.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FRONTEND_ROOT = path.resolve(__dirname, '..');

const BURN_DOWN = new Set([
  'components/avatar_header_input.tsx',
  'components/compose_attach_bar.tsx',
  'components/profile_block.tsx',
  'features/albutts/components/album_composer.tsx',
  'features/albutts/components/contribute_composer.tsx',
  'features/booth/components/booth_composer.tsx',
  'features/booth/components/edit_form.tsx',
  'features/events/components/create_event_form.tsx',
  'features/freethedream/components/project_composer.tsx',
  'features/kalendar/event_composer.tsx',
  'features/karporn/components/kar_composer.tsx',
  'features/krew/krew_photo_field.tsx',
  'features/kronikles/components/chronicle_composer.tsx',
  'features/me_hub/index.tsx',
  'features/moments/composer.tsx',
  'features/ui/components/nudge_compose_modal.tsx',
  'features/wachuneed/listing_photo_field.tsx',
  'features/wachuneed/shop_edit.tsx',
]);

// The drop zone itself is where the raw input is meant to live.
const ALLOWED = new Set(['components/media/photo_drop_zone.tsx']);

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

const takesImages = (tag: string) => /accept=[^>]*image\//.test(tag);

const photoInputFiles = () =>
  walk(FRONTEND_ROOT)
    .map((f) => path.relative(FRONTEND_ROOT, f))
    .filter((rel) =>
      fileInputTags(readFileSync(path.join(FRONTEND_ROOT, rel), 'utf8')).some(
        takesImages,
      ),
    );

describe('photo uploads use <PhotoDropZone>', () => {
  it('has no new raw photo file inputs', () => {
    const offenders = photoInputFiles().filter(
      (rel) => !ALLOWED.has(rel) && !BURN_DOWN.has(rel),
    );
    expect(
      offenders,
      'Use <PhotoDropZone> from mastodon/components/media for photo uploads',
    ).toEqual([]);
  });

  it('keeps the burn-down list to files that still need moving', () => {
    const current = new Set(photoInputFiles());
    const done = [...BURN_DOWN].filter((rel) => !current.has(rel));
    expect(done, 'These have moved on: take them off BURN_DOWN').toEqual([]);
  });
});
