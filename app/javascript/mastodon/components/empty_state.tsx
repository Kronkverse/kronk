// EmptyState — the rest-state pattern for a korner surface with no
// content yet ("Nothing coming up yet.", "You haven't gathered any
// Krews.", "No proposals live."). Every korner had been writing its own
// `.<korner>-page__empty` block with title + body copy that all
// looked the same — this is the shared version so future korners
// adopt-not-copy it (see `docs/kronk_platform_primitives.md`).
//
// Deliberately spartan: title (required) + body (optional) + action
// (optional, e.g. a `<Link>` to the composer). Icon is not a slot on
// purpose — the SpaceBadge in the header already carries the korner's
// icon, and doubling it up inside the empty message reads as noise.

interface EmptyStateProps {
  title: React.ReactNode;
  body?: React.ReactNode;
  // Optional trailing CTA — typically a `<Link>` to the composer or
  // a next step. Rendered on its own line under the body.
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  body,
  action,
}) => (
  <div className='empty-state' role='status'>
    <p className='empty-state__title'>{title}</p>
    {body && <p className='empty-state__body'>{body}</p>}
    {action && <div className='empty-state__action'>{action}</div>}
  </div>
);
