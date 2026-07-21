import { useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import type { ApiKommonsNode } from 'mastodon/api/kommons_nodes';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { NodeProposals } from 'mastodon/features/kommons_skeleton/components/node_proposals';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

const messages = defineMessages({
  title: { id: 'space.title', defaultMessage: 'Space' },
  purpose: { id: 'space.purpose', defaultMessage: 'Why this space exists' },
  steward: { id: 'space.steward', defaultMessage: 'Steward' },
  proposals: {
    id: 'space.proposals',
    defaultMessage: 'Open proposals about this space',
  },
  links: { id: 'space.links', defaultMessage: 'Connected spaces' },
});

// The Space page (/hub/kommons/space/:slug). Opened from a korner in the
// Kommons tree: the "why / who / what's being proposed" view of a space, so
// members can engage with how Kronk evolves. The tree is the map; this is the
// place. Reads identity + purpose + steward from the korner manifest (already
// in the store), the korner's open proposals, and its links to other spaces.
const SpacePage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const { slug = '' } = useParams<{ slug: string }>();
  const intl = useIntl();
  const korner = useKorner(slug);
  const kornerIcon = useKornerIcon(slug);
  const [nodes, setNodes] = useState<ApiKommonsNode[]>([]);

  useEffect(() => {
    let active = true;
    apiGetKommonsNodes()
      .then((res) => {
        if (active) setNodes(res.nodes);
        return undefined;
      })
      .catch(() => {
        // Links are supplementary; a failure here just hides the section.
      });
    return () => {
      active = false;
    };
  }, []);

  // A korner's links to other spaces = the union of its page-nodes' links,
  // with each target resolved to a readable label.
  const links = useMemo(() => {
    const label = new Map(nodes.map((n) => [n.id, n.label]));
    const mine = nodes.filter(
      (n) => n.id === slug || n.id.startsWith(`${slug}.`),
    );
    const seen = new Set<string>();
    const out: { to: string; label: string; description: string }[] = [];
    for (const n of mine) {
      for (const link of n.links) {
        if (seen.has(link.to)) continue;
        seen.add(link.to);
        out.push({
          to: link.to,
          label: label.get(link.to) ?? link.to,
          description: link.description,
        });
      }
    }
    return out;
  }, [nodes, slug]);

  const blurb =
    (korner?.launch as { blurb?: string } | null | undefined)?.blurb ??
    (korner?.hub_teaser as { static?: string } | null | undefined)?.static ??
    null;

  const name = korner?.name ?? slug;

  return (
    <Column>
      <ColumnHeader
        title={name}
        icon='kommons'
        iconComponent={kornerIcon}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{`${name} — ${intl.formatMessage(messages.title)}`}</title>
      </Helmet>

      <div className='space-page'>
        <header className='space-page__hero'>
          <h1 className='space-page__name'>{name}</h1>
          {korner?.purpose ? (
            <p className='space-page__purpose'>{korner.purpose}</p>
          ) : (
            blurb && <p className='space-page__purpose'>{blurb}</p>
          )}
          <Link to={`/hub/${slug}`} className='space-page__visit'>
            <FormattedMessage
              id='space.visit'
              defaultMessage='Visit {name}'
              values={{ name }}
            />
          </Link>
        </header>

        {korner?.steward && (
          <section className='space-page__section'>
            <h2 className='space-page__heading'>
              {intl.formatMessage(messages.steward)}
            </h2>
            <Link
              to={`/@${korner.steward.replace(/^@/, '')}`}
              className='space-page__steward'
            >
              @{korner.steward.replace(/^@/, '')}
            </Link>
          </section>
        )}

        <section className='space-page__section'>
          <h2 className='space-page__heading'>
            {intl.formatMessage(messages.proposals)}
          </h2>
          <NodeProposals korner={slug} />
        </section>

        {links.length > 0 && (
          <section className='space-page__section'>
            <h2 className='space-page__heading'>
              {intl.formatMessage(messages.links)}
            </h2>
            <ul className='space-page__links'>
              {links.map((link) => (
                <li key={link.to} className='space-page__link'>
                  <span className='space-page__link-label'>{link.label}</span>
                  <span className='space-page__link-desc'>
                    {link.description}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Column>
  );
};

export { SpacePage };
