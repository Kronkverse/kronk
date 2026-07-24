import classNames from 'classnames';

import { useKorner } from 'mastodon/hooks/useKorner';

// SpaceIntro — the standard one-line intro shown under a space title.
//
// Reads the manifest for `slug` and renders its display-voice `tagline`,
// falling back through the same chain the Kommons space page uses
// (`purpose` → `launch.blurb` → `hub_teaser.static`) so a korner that
// hasn't authored a tagline yet still shows something sensible. Renders
// nothing while the registry is loading or when no copy resolves, so it
// is safe to mount unconditionally at the top of a Stage.
//
// This replaces the per-korner bespoke landing intros (hub-page__lede,
// the Krew landing lede, you-portal__intro, and the KornerStub blurb) —
// one component, one style, copy owned by the manifest.
interface Props {
  slug: string | undefined;
  className?: string;
}

export const SpaceIntro: React.FC<Props> = ({ slug, className }) => {
  const korner = useKorner(slug);

  const intro =
    korner?.tagline ??
    korner?.purpose ??
    (korner?.launch as { blurb?: string } | null | undefined)?.blurb ??
    (korner?.hub_teaser as { static?: string } | null | undefined)?.static ??
    null;

  if (!intro) return null;

  return <p className={classNames('space-intro', className)}>{intro}</p>;
};
