// YOU — portal at /hub/you.
//
// This korner is a portal, not a wrapper. Kronk hosts the discoverable
// door into YOU (Kashka's personal-growth PWA — repo:
// Kashka-25/you-app-build); YOU keeps its own aesthetic + surface on
// its own domain. The Kronk-side stays a portal by design.
//
// Deeper integration between YOU and Kronk (shared auth, YOU signals
// on the Kronk profile) will land at the auth/data-projection layer
// via Anthemos's membrane — not by absorbing YOU into Kronk. So this
// portal shape is the *target*, not a temporary shim.

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Where the YOU PWA is deployed. Kept as a module constant for now;
// once we have proper env-driven kronk config for external korner
// destinations, this moves there.
const YOU_PORTAL_URL = 'https://you.kronk.info';

const messages = defineMessages({
  title: { id: 'you_portal.title', defaultMessage: 'YOU' },
  subtitle: {
    id: 'you_portal.subtitle',
    defaultMessage: 'Your Own Universe',
  },
  intro: {
    id: 'you_portal.intro',
    defaultMessage:
      'YOU is a self-facing companion to Kronk. Track your values, grow your Seed Being, log memories and moods, and follow your kosmic rhythms. Your YOU identity is yours — it lives in your pod, not on Kronk.',
  },
  cta: { id: 'you_portal.cta', defaultMessage: 'Open YOU' },
  ctaSubtext: {
    id: 'you_portal.cta_subtext',
    defaultMessage: 'Opens the YOU app in a new tab',
  },
  bulletValues: {
    id: 'you_portal.bullet.values',
    defaultMessage:
      '12 values to weave together and challenge yourself against',
  },
  bulletAvatar: {
    id: 'you_portal.bullet.avatar',
    defaultMessage: 'A Seed Being that grows as you do',
  },
  bulletMemory: {
    id: 'you_portal.bullet.memory',
    defaultMessage: 'A Memory Bank of what you\u2019ve been through',
  },
  bulletRhythms: {
    id: 'you_portal.bullet.rhythms',
    defaultMessage: 'Kosmic rhythms \u2014 sun, moon, and season',
  },
  futureHeading: {
    id: 'you_portal.future_heading',
    defaultMessage: 'How it fits together',
  },
  futureBody: {
    id: 'you_portal.future_body',
    defaultMessage:
      'YOU is its own app — it keeps its own aesthetic and surface. Kronk just hosts the door in. Later, YOU and Kronk will share sign-in and pass signals to each other through the Anthemos membrane, but YOU stays over there and Kronk stays over here.',
  },
});

interface Props {
  multiColumn?: boolean;
}

const YouPortal: React.FC<Props> = ({ multiColumn }) => {
  const intl = useIntl();
  const Icon = useKornerIcon('you');
  const title = intl.formatMessage(messages.title);

  return (
    <Column bindToDocument={!multiColumn} label={title}>
      <ColumnHeader
        title={title}
        icon='korner'
        iconComponent={Icon}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='you-portal'>
        <div className='you-portal__hero'>
          <span className='you-portal__glyph' aria-hidden='true'>
            <Icon />
          </span>
          <h1 className='you-portal__title'>{title}</h1>
          <p className='you-portal__subtitle'>
            {intl.formatMessage(messages.subtitle)}
          </p>
        </div>

        <p className='you-portal__intro'>
          {intl.formatMessage(messages.intro)}
        </p>

        <ul className='you-portal__bullets'>
          <li>{intl.formatMessage(messages.bulletValues)}</li>
          <li>{intl.formatMessage(messages.bulletAvatar)}</li>
          <li>{intl.formatMessage(messages.bulletMemory)}</li>
          <li>{intl.formatMessage(messages.bulletRhythms)}</li>
        </ul>

        <a
          className='you-portal__cta'
          href={YOU_PORTAL_URL}
          target='_blank'
          rel='noopener noreferrer'
        >
          {intl.formatMessage(messages.cta)}
        </a>
        <p className='you-portal__cta-subtext'>
          {intl.formatMessage(messages.ctaSubtext)}
        </p>

        <section className='you-portal__future'>
          <h2 className='you-portal__future-heading'>
            <FormattedMessage {...messages.futureHeading} />
          </h2>
          <p className='you-portal__future-body'>
            {intl.formatMessage(messages.futureBody)}
          </p>
        </section>
      </div>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default YouPortal;
export { YouPortal };
