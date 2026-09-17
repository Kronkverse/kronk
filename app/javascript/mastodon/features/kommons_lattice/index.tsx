// The Kommons Lattice — the Directory as an operable, orthogonal dendrogram.
//
// Route: /hub/kommons/lattice
// The rendering of the Directory tree: nodes from GET /api/v1/kommons/nodes,
// the shared proposal store, the same tokens. Structure is fixed; branches
// open one-per-level and fold away. Spec: docs/spaces/
// (KRONK_KOMMONS_LATTICE.md).

import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { Stage } from 'mastodon/components/stage';

import type { KommonsNode } from '../kommons_tree/data/nodes';
import { fromApiNodes } from '../kommons_tree/data/nodes';

import { Lattice } from './components/lattice';

const messages = defineMessages({
  title: {
    id: 'kommons_lattice.title',
    defaultMessage: '₭ommons · Directory',
  },
  loading: {
    id: 'kommons_lattice.loading',
    defaultMessage: 'Loading the Directory…',
  },
  loadError: {
    id: 'kommons_lattice.load_error',
    defaultMessage:
      'Could not load the Kommons Directory. Refresh to try again.',
  },
});

// Renders into the Frame's Stage. The ✦ Kommons space badge (back to Hub) and
// the Proposals ⇄ Directory view picker are Frame-provided; the old in-Stage
// KommonsExit pill is retired per docs/kronk_frame.md rule 4.
const KommonsLattice: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [nodes, setNodes] = useState<KommonsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGetKommonsNodes()
      .then((res) => {
        if (cancelled) return;
        setNodes(fromApiNodes(res.nodes));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
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
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='kommons-lattice'>
        {loading && (
          <p className='kommons-lattice__loading'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}
        {loadError && (
          <p className='kommons-lattice__error'>
            {intl.formatMessage(messages.loadError)}
          </p>
        )}
        {!loading && !loadError && <Lattice nodes={nodes} />}
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KommonsLattice;
