// An app with no icon shows its first letter instead (docs/spaces/kollection.md):
// on its card, filling the placeholder square, and as the icon on its page.

export const AppLetter: React.FC<{ name: string; large?: boolean }> = ({
  name,
  large = false,
}) => (
  <span
    className={`kollection-letter${large ? ' kollection-letter--large' : ''}`}
    aria-hidden='true'
  >
    {Array.from(name.trim())[0]?.toUpperCase() ?? '?'}
  </span>
);
