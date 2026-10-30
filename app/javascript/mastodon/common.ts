import Rails from '@rails/ujs';

import { noteAndroidApp } from './utils/android_app';

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
}
