import { Link } from 'react-router-dom';

// A caption is plain text with one visible affordance: `@username`
// links to the profile (fully-qualified `@user@instance` supported).
// Hashtags in a caption are deliberately NOT surfaced — the tagging
// architecture stays available for downstream indexing / search, but
// users don't see `#foo` become a link, and no `#` autocomplete or
// styling encourages the pattern in captions.

const MENTION_RE = /(@[\p{L}\p{N}_]+(?:@[\p{L}\p{N}_.-]+)?)/gu;

interface CaptionTextProps {
  text: string;
}

export const CaptionText: React.FC<CaptionTextProps> = ({ text }) => {
  const parts = text.split(MENTION_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('@') && part.length > 1) {
          const acct = part.slice(1);
          return (
            <Link key={i} to={`/@${acct}`} className='albutts-caption__mention'>
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};
