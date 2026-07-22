import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory } from 'react-router-dom';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Lattice } from 'mastodon/features/kommons_lattice/components/lattice';
import type { KommonsNode } from 'mastodon/features/kommons_skeleton/data/nodes';
import { fromApiNodes } from 'mastodon/features/kommons_skeleton/data/nodes';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

const messages = defineMessages({
  title: { id: 'propose_picker.title', defaultMessage: 'Open a Proposal' },
  searchPlaceholder: {
    id: 'propose_picker.search_placeholder',
    defaultMessage: 'Search for a page…',
  },
});

// Step one of proposing: pick the page your proposal is about. Browse the
// Kommons map (in pick mode — selecting a node opens the Proposer scoped to it)
// or search for the page by name. Every result / node routes to
// /hub/kommons/propose?node=<id>, so the proposal lands on that page.
const ProposePicker: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const history = useHistory();
  const kommonsIcon = useKornerIcon('kommons');
  const [nodes, setNodes] = useState<KommonsNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiGetKommonsNodes()
      .then((res) => {
        if (!cancelled) {
          setNodes(fromApiNodes(res.nodes));
          setLoaded(true);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes
      .filter((n) => n.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, nodes]);

  const handleQuery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const pickResult = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id;
      if (id) history.push(`/hub/kommons/propose?node=${id}`);
    },
    [history],
  );

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='kommons'
        iconComponent={kommonsIcon}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='propose-picker'>
        <header className='propose-picker__hero'>
          <h1 className='propose-picker__title'>
            <FormattedMessage
              id='propose_picker.heading'
              defaultMessage='Where does your proposal live?'
            />
          </h1>
        </header>

        <div className='propose-picker__search'>
          <input
            type='search'
            className='propose-picker__input'
            value={query}
            onChange={handleQuery}
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
            aria-label={intl.formatMessage(messages.searchPlaceholder)}
          />
          {results.length > 0 && (
            <ul className='propose-picker__results'>
              {results.map((n) => (
                <li key={n.id}>
                  <button
                    type='button'
                    className='propose-picker__result'
                    data-id={n.id}
                    onClick={pickResult}
                  >
                    <span className='propose-picker__result-label'>
                      {n.label}
                    </span>
                    <span className='propose-picker__result-url'>{n.url}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {loaded && nodes.length > 0 && (
          <div className='propose-picker__map'>
            <Lattice nodes={nodes} pick />
          </div>
        )}
      </div>
    </Column>
  );
};

export { ProposePicker };
