import { Link } from 'react-router-dom';

// A caption is plain text, but it carries the same lightweight
// affordances a normal post does — `#topic` links to the topic feed
// (Mastodon's /tags/:name), `@username` links to the profile. We
// deliberately keep this client-side and cheap: no server-side tag or
// mention records, no autocomplete, no federation. If a caption is
// later ingested into a proper status pipeline (e.g. when a photo is
// projected to the timeline), that pipeline can attach the richer
// metadata; captions themselves stay simple text.
//
// The regex splits on either `#tag` (letters/digits/underscore) OR
// `@user` (letters/digits/underscore, optionally followed by
// `@instance` for fully-qualified mentions). Anything else falls
// through as a plain text run.

const TOKEN_RE = /(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+(?:@[\p{L}\p{N}_.-]+)?)/gu;

interface CaptionTextProps {
  text: string;
}

export const CaptionText: React.FC<CaptionTextProps> = ({ text }) => {
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('#') && part.length > 1) {
          const tag = part.slice(1).toLowerCase();
          return (
            <Link key={i} to={`/tags/${tag}`} className='albutts-caption__tag'>
              {part}
            </Link>
          );
        }
        if (part.startsWith('@') && part.length > 1) {
          // For `@user` link to the local profile; for `@user@instance`
          // link to the fully-qualified acct route.
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
