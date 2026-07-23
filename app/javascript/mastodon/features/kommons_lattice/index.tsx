// The Kommons Lattice — the map as an operable, orthogonal dendrogram.
//
// Route: /hub/kommons/lattice
// The second view of the same data the radial Skeleton draws: same node ids
// (GET /api/v1/kommons/nodes), same proposal store, same tokens. Structure is
// fixed; branches open one-per-level and fold away. Spec: docs/spaces/
// (KRONK_KOMMONS_LATTICE.md).

import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';

import { KommonsExit } from '../kommons_tree/components/kommons_exit';
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
    defaultMessage: 'Could not load the Kommons Directory. Refresh to try again.',
  },
});

const KommonsLattice: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
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
    <Column bindToDocument={!multiColumn} label={title}>
      <ColumnHeader icon='gavel' title={title} multiColumn={multiColumn} />

      <div className='kommons-lattice'>
        <div className='kommons-tree__chrome'>
          <KommonsExit />
        </div>
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

      <Helmet>
        <title>{title}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default KommonsLattice;
