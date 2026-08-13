import classNames from 'classnames';

// KornerMeta — the middle-dot-separated metadata line that sits under a
// korner content title ("Tue 7pm · The Pier · 4 going · by @jane").
// Every korner had been writing this by hand: EventCard interleaves
// `{' '} &middot; {…}` runs inside a `.<korner>__meta` div, Krew cards
// do the same with `.krew-card__meta`, Kommons proposals with
// `.proposal__meta`, etc. Shared shape, shared separator, no reason
// for each to reinvent it.
//
// Deliberately unopinionated about the items themselves — callers pass
// any React nodes (dates, spans, links, `<FormattedDate>`s), and the
// primitive filters falsy entries and interleaves the separator.
// Highlight text with your own `<strong>` inside the item; the actor
// name gets whatever accent colour the caller wants (or none) — this
// primitive owns layout + separator, not typography of the contents.

interface KornerMetaProps {
  // Ordered list of meta items. Falsy values are filtered so callers
  // can pass conditional pieces inline (`condition && <X />`) without
  // wrapping in `.filter(Boolean)`.
  items: React.ReactNode[];
  className?: string;
}

export const KornerMeta: React.FC<KornerMetaProps> = ({ items, className }) => {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div className={classNames('korner-meta', className)}>
      {visible.map((item, i) => (
        <span key={i} className='korner-meta__item'>
          {i > 0 && (
            <span className='korner-meta__sep' aria-hidden='true'>
              {'\u00b7'}
            </span>
          )}
          {item}
        </span>
      ))}
    </div>
  );
};
