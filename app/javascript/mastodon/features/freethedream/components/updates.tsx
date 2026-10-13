import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdUpdate } from 'mastodon/api_types/freethedream';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

import { Section, formatAmount } from './shared';

// What's changed lately, here and in every section inside: who added
// what, who's bringing what, who took a job.

const messages = defineMessages({
  title: { id: 'freethedream.updates.title', defaultMessage: 'Updates' },
  section_added: {
    id: 'freethedream.updates.section_added',
    defaultMessage: '{name} added the section {what}',
  },
  need_added: {
    id: 'freethedream.updates.need_added',
    defaultMessage: '{name} needs {what}',
  },
  job_added: {
    id: 'freethedream.updates.job_added',
    defaultMessage: '{name} added the job {what}',
  },
  idea_added: {
    id: 'freethedream.updates.idea_added',
    defaultMessage: '{name} suggested {what}',
  },
  offer_added: {
    id: 'freethedream.updates.offer_added',
    defaultMessage: '{name} can bring {what}',
  },
  bringing: {
    id: 'freethedream.updates.bringing',
    defaultMessage: '{name} is bringing {what}',
  },
  claimed: {
    id: 'freethedream.updates.claimed',
    defaultMessage: '{name} took on {what}',
  },
  taken_on: {
    id: 'freethedream.updates.taken_on',
    defaultMessage: '{name} is making {what} happen',
  },
  done: {
    id: 'freethedream.updates.done',
    defaultMessage: '{name} marked {what} done',
  },
  someone: { id: 'freethedream.updates.someone', defaultMessage: 'Someone' },
});

export const Updates: React.FC<{ updates: FtdUpdate[]; hereId: string }> = ({
  updates,
  hereId,
}) => {
  const intl = useIntl();
  if (updates.length === 0) return null;

  return (
    <Section title={intl.formatMessage(messages.title)}>
      <ul className='freethedream-updates'>
        {updates.map((u) => {
          const title = u.data.title ?? '';
          const what =
            (u.verb === 'need_added' || u.verb === 'bringing') &&
            u.data.quantity &&
            (u.data.quantity > 1 || u.data.unit)
              ? `${formatAmount(u.data.quantity, u.data.unit ?? '')} ${title}`
              : title;
          const target = u.item_id
            ? `/hub/freethedream/i/${u.item_id}`
            : `/hub/freethedream/p/${u.data.section_id ?? u.project.id}`;
          return (
            <li key={u.id} className='freethedream-updates__row'>
              <Link to={target}>
                {intl.formatMessage(messages[u.verb], {
                  name:
                    u.account?.display_name ??
                    intl.formatMessage(messages.someone),
                  what,
                })}
              </Link>
              <span className='freethedream-updates__meta'>
                {u.project.id !== hereId && `${u.project.title} · `}
                <RelativeTimestamp timestamp={u.created_at} />
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};
