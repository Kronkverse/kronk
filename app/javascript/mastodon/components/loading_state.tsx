import { LoadingIndicator } from './loading_indicator';

// LoadingState — the transient counterpart to `<EmptyState>`. A muted,
// centred spinner + optional label for use inside a korner surface
// while its data fetches ("Loading Kalendar…", "Gathering
// proposals…"). Wraps Mastodon's `<LoadingIndicator>` (the spinner
// itself) with Kronk-standard layout + a label so korners stop
// writing their own `.<korner>-page__loading` blocks.

interface LoadingStateProps {
  // Optional label under the spinner. Omit for a bare spinner if the
  // surrounding context already makes the "loading" clear.
  label?: React.ReactNode;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ label }) => (
  <div className='loading-state' role='status' aria-live='polite'>
    <LoadingIndicator />
    {label && <p className='loading-state__label'>{label}</p>}
  </div>
);
