import { Icon } from 'mastodon/components/icon';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// A space's icon on the Krew screens: the same one the Hub and the space
// menu show (useKornerIcon). These screens used KornerGlyph's line art,
// which draws a different, generic picture for most spaces (a video
// camera for Huddle, a calendar for Kalendar).
export const KrewSpaceIcon: React.FC<{ slug: string; className?: string }> = ({
  slug,
  className,
}) => {
  const icon = useKornerIcon(slug);
  return <Icon id={slug} icon={icon} className={className} />;
};
