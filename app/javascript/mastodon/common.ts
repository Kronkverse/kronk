import Rails from '@rails/ujs';

import { noteAndroidApp } from './utils/android_app';
import { applyThemeVariant } from './utils/theme_variant';

export function start() {
  try {
    Rails.start();
  } catch {
    // If called twice
  }

  // Every page loads this, signed-out ones included, so the Android app is
  // recognised on its first launch, before anyone has signed in
  // (utils/android_app). main.tsx calls it too; the second call finds
  // nothing left in the address and does nothing new.
  noteAndroidApp();

  // The light design tokens only turn on under `data-theme='light'`. The
  // app stamps it in main.tsx; the Rails-served pages (settings, admin,
  // sign-in) never ran main.tsx, so under the light skin they kept the
  // dark tokens: dark grey headings and black labels on dark panels.
  applyThemeVariant();
}
