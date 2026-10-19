import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useParams } from 'react-router-dom';

import { apiFtdAudit } from 'mastodon/api/freethedream';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { useSpaceBack } from 'mastodon/components/space_back';

import {
  Loading,
  Person,
  Progress,
  Section,
  categoryMessages,
  useLoaded,
} from './shared';

const messages = defineMessages({
  intro: {
    id: 'freethedream.audit.intro',
    defaultMessage:
      'What this emergence needs, next to what its people have shared from their inventories. Share yours from Inventory.',
  },
  needed: { id: 'freethedream.audit.needed', defaultMessage: 'Needed' },
  shared: { id: 'freethedream.audit.shared', defaultMessage: 'Shared' },
  nothingNeeded: {
    id: 'freethedream.audit.nothing_needed',
    defaultMessage: 'Nothing needed',
  },
  nothingShared: {
    id: 'freethedream.audit.nothing_shared',
    defaultMessage: 'Nothing shared',
  },
  uncategorised: {
    id: 'freethedream.audit.uncategorised',
    defaultMessage: 'Not sorted yet',
  },
  title: { id: 'freethedream.audit', defaultMessage: 'Audit' },
});

// The synergistic audit for a project: needs against shared inventory,
// one category at a time.
export const AuditPage: React.FC = () => {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const { data: audit, failed } = useLoaded(id, () => apiFtdAudit(id));

  useSpaceBack(
    audit
      ? {
          href: `/hub/freethedream/p/${audit.root.id}`,
          label: audit.root.title,
        }
      : null,
  );

  if (!audit) return <Loading failed={failed} />;

  return (
    <KornerDetail
      className='freethedream-detail freethedream-detail--wide'
      title={intl.formatMessage(messages.title)}
      subtitle={
        <>
          {intl.formatMessage(messages.intro)}{' '}
          <Link to='/hub/freethedream/inventory'>
            <FormattedMessage
              id='freethedream.view.inventory'
              defaultMessage='Inventory'
            />
          </Link>
        </>
      }
    >
      {audit.categories.map((cat) => (
        <Section
          key={cat.category ?? 'none'}
          title={intl.formatMessage(
            cat.category
              ? categoryMessages[cat.category]
              : messages.uncategorised,
          )}
        >
          <div className='freethedream-audit'>
            <div className='freethedream-audit__col'>
              <h4 className='freethedream-audit__head'>
                {intl.formatMessage(messages.needed)}
              </h4>
              {cat.needs.length === 0 ? (
                <p className='freethedream__quiet'>
                  {intl.formatMessage(messages.nothingNeeded)}
                </p>
              ) : (
                <ul className='freethedream-audit__list'>
                  {cat.needs.map((need) => (
                    <li
                      key={need.id}
                      className={
                        need.covered < need.quantity
                          ? 'freethedream-audit__row freethedream-audit__row--gap'
                          : 'freethedream-audit__row'
                      }
                    >
                      <Link to={`/hub/freethedream/i/${need.id}`}>
                        {need.title}
                      </Link>
                      <Progress done={need.covered} of={need.quantity} />
                      {need.unit && (
                        <span className='freethedream-row__meta'>
                          {need.unit}
                        </span>
                      )}
                      {need.parts.length > 0 && (
                        <span className='freethedream-row__meta'>
                          {need.parts.join(', ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {cat.category && (
              <div className='freethedream-audit__col'>
                <h4 className='freethedream-audit__head'>
                  {intl.formatMessage(messages.shared)}
                </h4>
                {cat.shared.length === 0 ? (
                  <p className='freethedream__quiet'>
                    {intl.formatMessage(messages.nothingShared)}
                  </p>
                ) : (
                  <ul className='freethedream-audit__list'>
                    {cat.shared.map((a) => (
                      <li key={a.id} className='freethedream-audit__row'>
                        <span>
                          {a.title}
                          {a.quantity > 1 && ` ×${a.quantity}`}
                        </span>
                        <Person account={a.account} />
                        {a.note && (
                          <span className='freethedream-row__meta'>
                            {a.note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Section>
      ))}
    </KornerDetail>
  );
};
