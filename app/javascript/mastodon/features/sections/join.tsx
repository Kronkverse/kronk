import { useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetKrews } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { Stage } from 'mastodon/components/stage';

import { KornerCard, SectionHeader, useSectionKorners } from './korner_tiles';
import { JOIN_KORNERS } from './sections';

// Join (/join): people coming together (Tal, 2026-11-01). Your Krews
// first, then Krews you could join, then time and place (Kalendar and
// Map), then the other ways people get together.

const messages = defineMessages({
  title: { id: 'sections.join.title', defaultMessage: 'Join' },
  tagline: {
    id: 'sections.join.tagline',
    defaultMessage: 'Where people come together.',
  },
  yours: { id: 'sections.join.yours', defaultMessage: 'Your Krews' },
  discover: {
    id: 'sections.join.discover',
    defaultMessage: 'Krews you could join',
  },
  gather: { id: 'sections.join.gather', defaultMessage: 'Gather a Krew' },
  noKrews: {
    id: 'sections.join.no_krews',
    defaultMessage:
      'You’re not in a Krew yet. Join one below, or gather your own.',
  },
  members: {
    id: 'sections.join.members',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
  timePlace: {
    id: 'sections.join.time_place',
    defaultMessage: 'When and where',
  },
  together: { id: 'sections.join.together', defaultMessage: 'Together' },
  kronk: { id: 'sections.join.kronk', defaultMessage: 'Kronk' },
});

// How many Krews you could join show before "all of them" on the Krews
// page.
const DISCOVER_SHOWN = 8;

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || 'K';

const KrewCard: React.FC<{ krew: ApiKrewJSON }> = ({ krew }) => {
  const intl = useIntl();
  return (
    <SpaceCard
      to={`/hub/krew/${krew.slug}`}
      image={krew.image_url}
      placeholder={initial(krew.name)}
      title={krew.name}
      meta={intl.formatMessage(messages.members, { count: krew.member_count })}
    />
  );
};

const Join: React.FC = () => {
  const intl = useIntl();
  const [mine, setMine] = useState<ApiKrewJSON[] | null>(null);
  const [others, setOthers] = useState<ApiKrewJSON[]>([]);
  const korners = useSectionKorners(JOIN_KORNERS);
  const timePlace = korners.filter(
    (k) => k.slug === 'kalendar' || k.slug === 'map',
  );
  const together = korners.filter(
    (k) => k.slug !== 'kalendar' && k.slug !== 'map',
  );

  useEffect(() => {
    let cancelled = false;
    apiGetKrews({ scope: 'mine' })
      .then((krews) => {
        if (!cancelled) setMine(krews);
      })
      .catch(() => {
        if (!cancelled) setMine([]);
      });
    apiGetKrews({ scope: 'discoverable' })
      .then((krews) => {
        if (!cancelled)
          setOthers(krews.filter((k) => !k.viewer_role && !k.archived));
      })
      .catch(() => {
        // Nothing to suggest; the rest of the page stands.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const title = intl.formatMessage(messages.title);

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className='section-page section-page--join'>
        <SectionHeader
          title={title}
          tagline={intl.formatMessage(messages.tagline)}
        />

        <section className='section-page__section section-page__krews'>
          <h2 className='korner-section-heading'>
            <FormattedMessage {...messages.yours} />
          </h2>
          {mine?.length === 0 && (
            <p className='section-page__hint'>
              <FormattedMessage {...messages.noKrews} />
            </p>
          )}
          <SpaceGrid className='section-page__tiles'>
            {(mine ?? []).map((krew) => (
              <KrewCard key={krew.id} krew={krew} />
            ))}
            <SpaceCard
              to='/hub/krew/composer'
              placeholder='+'
              title={intl.formatMessage(messages.gather)}
            />
          </SpaceGrid>
        </section>

        {others.length > 0 && (
          <section className='section-page__section section-page__discover'>
            <h2 className='korner-section-heading'>
              <FormattedMessage {...messages.discover} />
            </h2>
            <SpaceGrid layout='row' className='section-page__tiles'>
              {others.slice(0, DISCOVER_SHOWN).map((krew) => (
                <KrewCard key={krew.id} krew={krew} />
              ))}
            </SpaceGrid>
          </section>
        )}

        {timePlace.length > 0 && (
          <section className='section-page__section'>
            <h2 className='korner-section-heading'>
              <FormattedMessage {...messages.timePlace} />
            </h2>
            <SpaceGrid className='section-page__tiles'>
              {timePlace.map((k) => (
                <KornerCard key={k.slug} korner={k} />
              ))}
            </SpaceGrid>
          </section>
        )}

        <section className='section-page__section'>
          <h2 className='korner-section-heading'>
            <FormattedMessage {...messages.together} />
          </h2>
          <SpaceGrid className='section-page__tiles'>
            {together.map((k) => (
              <KornerCard key={k.slug} korner={k} />
            ))}
            <SpaceCard
              to='/kronk'
              placeholder='Ж'
              title={intl.formatMessage(messages.kronk)}
            />
          </SpaceGrid>
        </section>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Join;
