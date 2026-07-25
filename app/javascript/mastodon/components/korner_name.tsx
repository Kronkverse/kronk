// Renders a korner name with an in-word emphasis convention: any run
// of 3+ consecutive uppercase letters sandwiched inside a
// lowercase-flanked word (e.g. `mARTketplace`) is lowercased and
// underlined instead of shouted in ALL CAPS. Every other korner name
// stays as-is because none of them use that convention.
//
// Used at the hero display sites — SpaceHeader's <h1> title and
// SpaceBadge's label. Smaller usages (aria-labels, tooltips, sidebar
// tiles) keep the plain string form since the styling wouldn't read
// at that size and screen readers prefer plain text anyway.

const CAP_RUN_RE = /^([a-z]+)([A-Z]{3,})([a-z].*)$/;

interface Props {
  name: string;
  className?: string;
}

export const KornerName: React.FC<Props> = ({ name, className }) => {
  const match = CAP_RUN_RE.exec(name);
  if (!match) {
    return <span className={className}>{name}</span>;
  }
  const [, before, emphasis, after] = match;
  return (
    <span className={className}>
      {before}
      <u className='korner-name__emphasis'>{emphasis?.toLowerCase()}</u>
      {after}
    </span>
  );
};
