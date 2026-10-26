import { defineMessages, useIntl } from 'react-intl';

import ListAltIcon from '@/material-icons/400-24px/list_alt.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import LockOpenIcon from '@/material-icons/400-24px/lock_open.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import type { ApiKrewRequirementJSON, KrewAccess } from 'mastodon/api/krew';
import { eventLabel } from 'mastodon/components/event_search';
import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';

// How a Krew lets people in, as a small icon beside its name: on the
// directory rows and the Krew page. The four values are `Krew::ACCESS_LEVELS`
// (docs/spaces/krew.md, Joining). Kommons "Krews Type",
// https://kronk.info/hub/kommons/p/117482707167518494.

const messages = defineMessages({
  open: { id: 'krew.marker.open', defaultMessage: 'Open' },
  approval: { id: 'krew.marker.approval', defaultMessage: 'Asks to join' },
  requirement_gated: {
    id: 'krew.marker.requirement_gated',
    defaultMessage: 'Has requirements',
  },
  invite_only: {
    id: 'krew.marker.invite_only',
    defaultMessage: 'Invite-only',
  },
  reqRowLocatedIn: {
    id: 'krew.settings.req_row.located_in',
    defaultMessage: 'Located in {value}',
  },
  reqRowGoingTo: {
    id: 'krew.settings.req_row.going_to',
    defaultMessage: 'Going to {event}',
  },
  reqRowVouched: {
    id: 'krew.settings.req_row.vouched_by_member',
    defaultMessage: 'Vouched by a member',
  },
});

const ICONS: Record<KrewAccess, { id: string; icon: IconProp }> = {
  open: { id: 'lock_open', icon: LockOpenIcon },
  approval: { id: 'person_add', icon: PersonAddIcon },
  requirement_gated: { id: 'list_alt', icon: ListAltIcon },
  invite_only: { id: 'lock', icon: LockIcon },
};

export const KrewAccessMark: React.FC<{
  access: KrewAccess;
  className?: string;
}> = ({ access, className }) => {
  const intl = useIntl();
  const { id, icon } = ICONS[access];
  return (
    <Icon
      id={id}
      icon={icon}
      className={className}
      aria-label={intl.formatMessage(messages[access])}
    />
  );
};

// One requirement of a requirement-gated Krew, in words: on Settings (the
// list to edit) and on the Krew page (what someone joining needs).
export const requirementSummary = (
  req: ApiKrewRequirementJSON,
  intl: ReturnType<typeof useIntl>,
): string => {
  switch (req.kind) {
    case 'located_in':
      return intl.formatMessage(messages.reqRowLocatedIn, {
        value: req.region ?? '—',
      });
    case 'attending_event':
      // Named only for someone who can see the event; "An event" otherwise.
      return intl.formatMessage(messages.reqRowGoingTo, {
        event: eventLabel(intl, req.event ?? null),
      });
    case 'vouched_by_member':
      return intl.formatMessage(messages.reqRowVouched);
  }
};
