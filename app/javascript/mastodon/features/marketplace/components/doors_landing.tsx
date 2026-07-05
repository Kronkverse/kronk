import { FormattedMessage } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { useIdentity } from 'mastodon/identity_context';

interface Door {
  key: string;
  variant: 'creation' | 'market' | 'service' | 'event';
  numeral: string;
  title: React.ReactNode;
  desc: React.ReactNode;
  href: string;
}

const DOORS: Door[] = [
  {
    key: 'creation',
    variant: 'creation',
    numeral: 'I',
    title: (
      <FormattedMessage
        id='marketplace.door.creations.title'
        defaultMessage='Creations'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.door.creations.desc'
        defaultMessage="Art, illustration, music, digital work, handmade objects. The gallery of the community's making."
      />
    ),
    href: '/marketplace/creations',
  },
  {
    key: 'marketplace',
    variant: 'market',
    numeral: 'II',
    title: (
      <FormattedMessage
        id='marketplace.door.marketplace.title'
        defaultMessage='Marketplace'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.door.marketplace.desc'
        defaultMessage='General listings, goods, and items — new and used. Browse by category.'
      />
    ),
    href: '/marketplace/marketplace',
  },
  {
    key: 'service',
    variant: 'service',
    numeral: 'III',
    title: (
      <FormattedMessage
        id='marketplace.door.services.title'
        defaultMessage='Services'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.door.services.desc'
        defaultMessage='Offerings, skills, sessions, and expertise. Connect with practitioners and guides.'
      />
    ),
    href: '/marketplace/services',
  },
  {
    key: 'event',
    variant: 'event',
    numeral: 'IV',
    title: (
      <FormattedMessage
        id='marketplace.door.events.title'
        defaultMessage='Events'
      />
    ),
    desc: (
      <FormattedMessage
        id='marketplace.door.events.desc'
        defaultMessage='Gatherings, workshops, ceremonies, performances. The community calendar.'
      />
    ),
    href: '/kalendar',
  },
];

export const DoorsLanding: React.FC = () => {
  const history = useHistory();
  const { signedIn } = useIdentity();

  const handleEnter = (href: string) => {
    history.push(href);
  };

  return (
    <div className='marketplace-landing'>
      <section className='marketplace-hero'>
        <p className='marketplace-eyebrow marketplace-hero__eyebrow'>
          <FormattedMessage
            id='marketplace.hero.eyebrow'
            defaultMessage='Kronk'
          />
        </p>
        <h1 className='marketplace-hero__title'>
          <FormattedMessage
            id='marketplace.hero.title'
            defaultMessage='The {emphasis}'
            values={{
              emphasis: (
                <em>
                  <FormattedMessage
                    id='marketplace.hero.title_emphasis'
                    defaultMessage='Marketplace'
                  />
                </em>
              ),
            }}
          />
        </h1>
        <p className='marketplace-hero__sub'>
          <FormattedMessage
            id='marketplace.hero.sub'
            defaultMessage='A threshold space for creators, makers, guides, and gatherers. Buy, sell, offer, and gather — within the Kronk community.'
          />
        </p>
        {signedIn && (
          <button
            type='button'
            className='marketplace-hero__cta'
            onClick={() => {
              history.push('/marketplace/new');
            }}
          >
            <FormattedMessage
              id='marketplace.hero.share_cta'
              defaultMessage='Share something'
            />
          </button>
        )}
      </section>

      <section className='marketplace-doors-section'>
        <p className='marketplace-eyebrow marketplace-doors-section__eyebrow'>
          <FormattedMessage
            id='marketplace.thresholds'
            defaultMessage='Four thresholds'
          />
        </p>
        <h2 className='marketplace-doors-section__heading'>
          <FormattedMessage
            id='marketplace.where_to'
            defaultMessage='Where do you wish to go?'
          />
        </h2>

        <div className='marketplace-doors' role='list'>
          {DOORS.map((door) => (
            <button
              key={door.key}
              type='button'
              className={`marketplace-door marketplace-door--${door.variant}`}
              onClick={() => {
                handleEnter(door.href);
              }}
            >
              <span className='marketplace-door__arch' aria-hidden='true' />
              <span
                className='marketplace-door__arch-inner'
                aria-hidden='true'
              />
              <span className='marketplace-door__enter' aria-hidden='true'>
                <FormattedMessage
                  id='marketplace.door.enter'
                  defaultMessage='Enter →'
                />
              </span>
              <span className='marketplace-eyebrow marketplace-door__numeral'>
                {door.numeral}
              </span>
              <h3 className='marketplace-door__title'>{door.title}</h3>
              <p className='marketplace-door__desc'>{door.desc}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
