import { useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useLocation, useParams } from 'react-router-dom';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import type { ApiKommonsNode } from 'mastodon/api/kommons_nodes';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { NodeProposals } from 'mastodon/features/kommons_skeleton/components/node_proposals';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

const messages = defineMessages({
  title: { id: 'node_meta.title', defaultMessage: 'Page' },
  proposals: {
    id: 'node_meta.proposals',
    defaultMessage: 'Open proposals about this page',
  },
  links: { id: 'node_meta.links', defaultMessage: 'Connected pages' },
  notFound: {
    id: 'node_meta.not_found',
    defaultMessage: 'This page could not be found.',
  },
});

// The meta page for a single node (/hub/kommons/node/:nodeId). Reached by
// clicking a Finger in the Kommons tree: the "what is this page, and what's
// being proposed about it" view. It never opens the product page directly —
// a "Go to this page" button does that, so the tree stays a governance surface.
// Create a proposal about this page via the Ӂ menu (scoped to this node).
const NodeMetaPage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const { nodeId = '' } = useParams<{ nodeId: string }>();
  const location = useLocation();
  // Return to the map you arrived from, so you can open a Finger, glance, and
  // move to the next without leaving the skeleton behind.
  const from =
    new URLSearchParams(location.search).get('from') === 'lattice'
      ? 'lattice'
      : 'skeleton';
  const intl = useIntl();
  const kommonsIcon = useKornerIcon('kommons');
  const [nodes, setNodes] = useState<ApiKommonsNode[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    apiGetKommonsNodes()
      .then((res) => {
        if (active) {
          setNodes(res.nodes);
          setLoaded(true);
        }
        return undefined;
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const node = useMemo(
    () => nodes.find((n) => n.id === nodeId),
    [nodes, nodeId],
  );

  const links = useMemo(() => {
    if (!node) return [];
    const label = new Map(nodes.map((n) => [n.id, n.label]));
    return node.links.map((link) => ({
      to: link.to,
      label: label.get(link.to) ?? link.to,
      description: link.description,
    }));
  }, [node, nodes]);

  const name = node?.label ?? nodeId;
  // Kronk's org pages are Rails-served, so a full navigation; SPA routes use
  // an in-app link.
  const isRails = node?.url.startsWith('/kronk') ?? false;

  return (
    <Column>
      <ColumnHeader
        title={name}
        icon='kommons'
        iconComponent={kommonsIcon}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{`${name} — ${intl.formatMessage(messages.title)}`}</title>
      </Helmet>

      <div className='space-page'>
        <Link to={`/hub/kommons/${from}`} className='kommons-back-map'>
          <FormattedMessage
            id='kommons.back_to_map'
            defaultMessage='← Back to the map'
          />
        </Link>

        {loaded && !node && (
          <div className='governance-page__empty'>
            {intl.formatMessage(messages.notFound)}
          </div>
        )}

        {node && (
          <>
            <header className='space-page__hero'>
              <h1 className='space-page__name'>{node.label}</h1>
              <p className='space-page__purpose'>
                <code>{node.url}</code>
                {node.lifecycle !== 'live' && (
                  <span className='node-meta__lifecycle'>{node.lifecycle}</span>
                )}
              </p>
              {isRails ? (
                <a href={node.url} className='space-page__visit'>
                  <FormattedMessage
                    id='node_meta.goto'
                    defaultMessage='Go to this page'
                  />
                </a>
              ) : (
                <Link to={node.url} className='space-page__visit'>
                  <FormattedMessage
                    id='node_meta.goto'
                    defaultMessage='Go to this page'
                  />
                </Link>
              )}
            </header>

            <section className='space-page__section'>
              <h2 className='space-page__heading'>
                {intl.formatMessage(messages.proposals)}
              </h2>
              <NodeProposals nodeId={node.id} />
            </section>

            {links.length > 0 && (
              <section className='space-page__section'>
                <h2 className='space-page__heading'>
                  {intl.formatMessage(messages.links)}
                </h2>
                <ul className='space-page__links'>
                  {links.map((link) => (
                    <li key={link.to} className='space-page__link'>
                      <span className='space-page__link-label'>
                        {link.label}
                      </span>
                      <span className='space-page__link-desc'>
                        {link.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Column>
  );
};

export { NodeMetaPage };
