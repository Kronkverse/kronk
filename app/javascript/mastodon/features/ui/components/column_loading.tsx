import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import type { Props as ColumnHeaderProps } from 'mastodon/components/column_header';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';

export const ColumnLoading: React.FC<ColumnHeaderProps> = (otherProps) => (
  <Column>
    <ColumnHeader {...otherProps} />
    <div className='scrollable' />
  </Column>
);

// Loading fallback for Hub / korner routes, which render into a <Stage>
// rather than a <Column>. Uses the Stage's own chrome-less shell + a spinner
// so the legacy <ColumnHeader> bar doesn't flash at the top while the route's
// lazy bundle downloads. See react_router_helpers.jsx and components/stage.tsx.
export const StageLoading: React.FC = () => (
  <div className='kronk-stage kronk-stage--loading' role='region'>
    <LoadingIndicator />
  </div>
);
