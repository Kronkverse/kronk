import type { IntlShape } from 'react-intl';
import { defineMessages, useIntl } from 'react-intl';

import LinkIcon from '@/material-icons/400-24px/link.svg?react';
import type { AttachmentAudience } from 'mastodon/api/attachments';
import { Icon } from 'mastodon/components/icon';

// Who can see a Konnected record, said in a word or two (docs/design.md,
// Konnect, "Same as"; decisions.md, 2026-10-25). Every Konnected tile, in a
// composer's Konnect row and on a record's page, carries one under its
// title; the reach control's Same as option says the long form.
//
//   Everyone · Mates · Orbit · Just me · Growers · Growers + Climbers
//   · Mates + Growers · Growers + 2 Krews (Krews you may not see, counted)
//
// A tile whose audience this record follows also says "Same as".

const messages = defineMessages({
  everyone: { id: 'audience_marker.everyone', defaultMessage: 'Everyone' },
  mates: { id: 'audience_marker.mates', defaultMessage: 'Mates' },
  orbit: { id: 'audience_marker.orbit', defaultMessage: 'Orbit' },
  justMe: { id: 'audience_marker.just_me', defaultMessage: 'Just me' },
  // An event seen by no Krew and no reach is for the people invited.
  invited: { id: 'audience_marker.invited', defaultMessage: 'Invited' },
  hiddenKrews: {
    id: 'audience_marker.hidden_krews',
    defaultMessage: '{count, plural, one {# Krew} other {# Krews}}',
  },
  joined: {
    id: 'audience_marker.joined',
    defaultMessage: '{first} + {rest}',
  },
  sameAs: { id: 'audience_marker.same_as', defaultMessage: 'Same as' },
  followsThis: {
    id: 'audience_marker.follows_this',
    defaultMessage: 'Audience follows this',
  },
});

type Style = 'short' | 'long';

// The audience in words: `short` for a tile ("Growers + Climbers"), `long`
// for a sentence or a menu ("Growers and Climbers"). Null when the record
// has no audience to say (a Krew, a proposal).
export const audienceText = (
  intl: IntlShape,
  audience: AttachmentAudience | null | undefined,
  slug: string,
  style: Style = 'short',
): string | null => {
  if (!audience?.tier) return null;
  if (audience.tier === 'public') return intl.formatMessage(messages.everyone);

  const parts: string[] = [];
  if (audience.tier === 'mates') parts.push(intl.formatMessage(messages.mates));
  if (audience.tier === 'orbit') parts.push(intl.formatMessage(messages.orbit));
  audience.krews.forEach((krew) => parts.push(krew.name));
  if (audience.hidden_krews > 0)
    parts.push(
      intl.formatMessage(messages.hiddenKrews, {
        count: audience.hidden_krews,
      }),
    );

  if (parts.length === 0)
    return intl.formatMessage(
      slug === 'kalendar' ? messages.invited : messages.justMe,
    );
  if (style === 'long') return intl.formatList(parts, { type: 'conjunction' });
  return parts.reduce((acc, part) =>
    intl.formatMessage(messages.joined, { first: acc, rest: part }),
  );
};

// The Krews named in `audience`, in words ("Growers and Climbers").
export const krewNames = (intl: IntlShape, names: string[]) =>
  intl.formatList(names, { type: 'conjunction' });

// Why people who see `other` can't open `own` (docs/design.md, Konnect,
// mismatch notes): its Krews that aren't among `own`'s, and whether `other`
// is for everyone while `own` isn't. Mates and Orbit are relative to their
// owner, so they never make a note, and neither do Krews hidden from you.
// Null when there's nothing to say.
export interface AudienceMismatch {
  krews: string[];
  everyone: boolean;
}

export const audienceMismatch = (
  own: AttachmentAudience | null | undefined,
  other: AttachmentAudience | null | undefined,
): AudienceMismatch | null => {
  if (!own?.tier || !other?.tier || own.tier === 'public') return null;
  if (other.tier === 'public') return { krews: [], everyone: true };
  if (own.tier !== 'self_only') return null;
  const ownIds = new Set(own.krews.map((k) => k.id));
  const krews = other.krews.filter((k) => !ownIds.has(k.id)).map((k) => k.name);
  return krews.length > 0 ? { krews, everyone: false } : null;
};

interface AudienceMarkerProps {
  audience: AttachmentAudience | null | undefined;
  slug: string;
  // This record's audience follows the tile's record.
  leads?: boolean;
}

// The quiet line(s) under a tile's title.
export const AudienceMarker: React.FC<AudienceMarkerProps> = ({
  audience,
  slug,
  leads = false,
}) => {
  const intl = useIntl();
  const text = audienceText(intl, audience, slug);
  if (!text && !leads) return null;

  return (
    <>
      {text && <span className='space-tile__audience'>{text}</span>}
      {leads && (
        <span
          className='space-tile__same'
          title={intl.formatMessage(messages.followsThis)}
        >
          <Icon id='link' icon={LinkIcon} />
          {intl.formatMessage(messages.sameAs)}
        </span>
      )}
    </>
  );
};

// Korners whose records can take another's audience (Kronk::Audience
// adapters that write; docs/korners/adding_a_korner.md §2.7).
export const AUDIENCE_FOLLOWERS: readonly string[] = [
  'albutts',
  'art',
  'cinema',
  'karporn',
  'kronikles',
  'wachuneed',
];
