import classNames from 'classnames';

import { useKorner } from 'mastodon/hooks/useKorner';

import { KornerName } from './korner_name';

// SpaceHeader — the shared, in-content header every /hub/<slug> korner
// starts with. Reads the manifest for `slug` and renders the space
// name as a proper display-typography title above the tagline
// paragraph — both scroll with the korner's content rather than
// floating as chrome. The top-left SpaceBadge pill (SpaceNav slot)
// stays as the persistent back-to-Hub affordance; this component
// gives the landing surface a title of its own.
//
// The tagline falls back through the same chain the Kommons space
// page uses (`purpose` → `launch.blurb` → `hub_teaser.static`) so a
// korner that hasn't authored a display tagline yet still shows
// something sensible. If neither name nor tagline resolve (registry
// still loading, unknown slug), the whole header renders as null
// rather than a hollow shell.
//
// Marked `data-frame-header` so Stage's dev-only Frame-parasite
// warning (docs/korners/korner_standard.md L11) can exclude the
// header's own <h1> from the "korner shouldn't emit <h1>" check.
// L11 remains a real rule for korner index files — this component,
// as Frame-provided chrome, is the sanctioned <h1> for the space.

interface Props {
  slug: string | undefined;
  className?: string;
}

export const SpaceHeader: React.FC<Props> = ({ slug, className }) => {
  const korner = useKorner(slug);

  if (!korner) return null;

  const tagline =
    korner.tagline ??
    korner.purpose ??
    (korner.launch as { blurb?: string } | null | undefined)?.blurb ??
    (korner.hub_teaser as { static?: string } | null | undefined)?.static ??
    null;

  return (
    <header
      className={classNames('space-header', className)}
      data-frame-header=''
    >
      <h1 className='space-header__title'>
        <KornerName name={korner.name} />
      </h1>
      {tagline && <p className='space-header__tagline'>{tagline}</p>}
    </header>
  );
};
