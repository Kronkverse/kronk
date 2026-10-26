import { Component } from 'react';

// SilentErrorBoundary — renders nothing in place of a child that throws,
// so one broken piece (a feed card, a map) can't take the whole app down to
// the app-level error page. Use it around self-contained pieces whose
// absence the page survives; anything the page needs should fail loudly.
// React still logs the caught error to the console.
//
// Upstream's `components/hashtag.tsx` keeps its own private copy; this is
// Kronk's shared one (docs/design.md, Platform primitives).

interface Props {
  children: React.ReactNode;
}

interface State {
  error: boolean;
}

export class SilentErrorBoundary extends Component<Props, State> {
  state: State = { error: false };

  static getDerivedStateFromError(): State {
    return { error: true };
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}
