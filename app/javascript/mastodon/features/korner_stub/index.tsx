import { FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Shared "coming soon" surface for korners whose manifest has landed
// but whose models/UI haven't. Renders whatever the manifest declares
// for the launch card (blurb + CTA) so the placeholder still feels
// like it belongs. Every 2.x korner marked `enforced: false` hits this
// route until its own feature ships.

interface Params { slug?: string }

export const KornerStub: React.FC<{ multiColumn?: boolean; slug?: string }> = ({
  multiColumn,
  slug: propSlug,
}) => {
  const params = useParams<Params>();
  const slug = propSlug ?? params.slug;

  const korner = useKorner(slug);
  const Icon = useKornerIcon(slug);

  const title = korner?.name ?? slug ?? 'Korner';
  const blurb =
    (korner?.launch?.blurb as string | undefined) ??
    (korner?.hub_teaser?.static as string | undefined) ??
    '';

  return (
    <Column bindToDocument label={title}>
      <ColumnHeader
        title={title}
        icon='korner'
        iconComponent={Icon}
        showBackButton
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='korner-stub'>
        <span className='korner-stub__glyph' aria-hidden='true'>
          <Icon />
        </span>
        <h1 className='korner-stub__title'>{title}</h1>
        {blurb && <p className='korner-stub__blurb'>{blurb}</p>}
        <p className='korner-stub__pending'>
          <FormattedMessage
            id='korner_stub.pending'
            defaultMessage='Coming soon — the manifest is in place, the interface lands next.'
          />
        </p>
      </div>
    </Column>
  );
};

// Individual bindings so each korner slug lands on its own bundle
// route and can be swapped for a real feature component when ready.
export const MomentsStub: React.FC<{ multiColumn?: boolean }> = (props) => (
  <KornerStub {...props} slug='moments' />
);
export const AlbuttsStub: React.FC<{ multiColumn?: boolean }> = (props) => (
  <KornerStub {...props} slug='albutts' />
);
export const KompassStub: React.FC<{ multiColumn?: boolean }> = (props) => (
  <KornerStub {...props} slug='kompass' />
);

