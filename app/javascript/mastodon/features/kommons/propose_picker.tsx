import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory } from 'react-router-dom';

import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { Stage } from 'mastodon/components/stage';
import { Lattice } from 'mastodon/features/kommons_lattice/components/lattice';
import type { KommonsNode } from 'mastodon/features/kommons_tree/data/nodes';
import { fromApiNodes } from 'mastodon/features/kommons_tree/data/nodes';

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
const ProposePicker: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
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
    return nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query, nodes]);

  const handleQuery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const pickResult = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id;
      // Location object, not a string — the history wrapper mangles `?query`
      // into pathname otherwise (see components/router.tsx).
      if (id)
        history.push({
          pathname: '/hub/kommons/propose',
          search: `?node=${id}`,
        });
    },
    [history],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
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
    </Stage>
  );
};

export { ProposePicker };
