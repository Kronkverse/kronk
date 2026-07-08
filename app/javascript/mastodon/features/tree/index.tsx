import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, spaceColor } from 'mastodon/planets';

import type { TopBranch } from './types';

const messages = defineMessages({
  heading: { id: 'tree.title', defaultMessage: 'Tree' },
});

// Seeded top structure per docs/tree-brief.md — editable in-tool later,
// not baked in. Kept here so the scaffold shows the shape of the model
// without a backend.
const SEED: TopBranch[] = [
  {
    key: 'digital',
    name: 'Digital',
    tagline: 'Development · Sovereignty · Infrastructure',
    color: '#563acc',
    sublayers: [
      { id: 'digital/development', name: 'Development', ideas: [] },
      { id: 'digital/sovereignty', name: 'Sovereignty', ideas: [] },
      { id: 'digital/infrastructure', name: 'Infrastructure', ideas: [] },
    ],
  },
  {
    key: 'community',
    name: 'Community',
    tagline: 'User Experience · Relationships · Community',
    color: '#3fb984',
    sublayers: [
      { id: 'community/ux', name: 'User Experience', ideas: [] },
      { id: 'community/relationships', name: 'Relationships', ideas: [] },
      { id: 'community/community', name: 'Community', ideas: [] },
    ],
  },
  {
    key: 'platform',
    name: 'Platform',
    tagline: 'Governance · Structure · Vision',
    color: '#e8b04b',
    sublayers: [
      { id: 'platform/governance', name: 'Governance', ideas: [] },
      { id: 'platform/structure', name: 'Structure', ideas: [] },
      { id: 'platform/vision', name: 'Vision', ideas: [] },
    ],
  },
];

const Tree: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  return (
    <Column bindToDocument={!multiColumn}>
      <ColumnHeader
        icon='account_tree'
        iconComponent={planetIcon('Tree')}
        title={intl.formatMessage(messages.heading)}
        multiColumn={multiColumn}
      />

      <div
        className='tree-page scrollable'
        style={{ '--space-color': spaceColor('Tree') } as React.CSSProperties}
      >
        <header className='tree-hero'>
          <p className='tree-eyebrow'>
            <FormattedMessage
              id='tree.eyebrow'
              defaultMessage="Kronk's pipeline"
            />
          </p>
          <h2 className='tree-hero__title serif'>
            <FormattedMessage id='tree.hero.title' defaultMessage='Tree' />
          </h2>
          <p className='tree-hero__lede'>
            <FormattedMessage
              id='tree.hero.lede'
              defaultMessage='A navigable map of everything in Kronk’s pipeline — what exists, what’s planned, what depends on what, and what a dev can pick up right now.'
            />
          </p>
          <p className='tree-hero__phase'>
            <FormattedMessage
              id='tree.hero.phase'
              defaultMessage='Scaffold. The interactive Map and List views are being ported from the {prototype}.'
              values={{
                prototype: (
                  <a
                    className='tree-hero__proto-link'
                    href='/tree.html'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <FormattedMessage
                      id='tree.hero.prototype_link'
                      defaultMessage='reference prototype'
                    />
                  </a>
                ),
              }}
            />
          </p>
        </header>

        <div className='tree-branches'>
          {SEED.map((branch) => (
            <section
              key={branch.key}
              className={`tree-branch tree-branch--${branch.key}`}
              style={
                { '--branch-color': branch.color } as React.CSSProperties
              }
            >
              <header className='tree-branch__header'>
                <h3 className='tree-branch__name serif'>{branch.name}</h3>
                <p className='tree-branch__tagline'>{branch.tagline}</p>
              </header>

              <ul className='tree-branch__sublayers'>
                {branch.sublayers.map((sl) => (
                  <li key={sl.id} className='tree-sublayer'>
                    <span className='tree-sublayer__name'>{sl.name}</span>
                    <span className='tree-sublayer__ideas-count'>
                      <FormattedMessage
                        id='tree.sublayer.ideas_count'
                        defaultMessage='{count, plural, =0 {no ideas yet} one {# idea} other {# ideas}}'
                        values={{ count: sl.ideas.length }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Tree;
