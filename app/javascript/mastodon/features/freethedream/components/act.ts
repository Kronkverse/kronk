import { showAlertForError } from 'mastodon/actions/alerts';
import { store } from 'mastodon/store';

// Runs a FreeTheDream action and, if it fails, says so. These calls used to
// end in `void apiFtd…().then(onChange)` with no catch, so a failed claim,
// take-on or resolve did nothing visible.
export function act(promise: Promise<unknown>): Promise<void> {
  return promise.then(
    () => undefined,
    (error: unknown) => {
      store.dispatch(showAlertForError(error));
    },
  );
}
