import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, spaceColor } from 'mastodon/planets';

import type { TreeNode, TreeDependency } from './types';
import { fetchNodes, fetchDependencies } from './api';
import {
  childrenOf,
  ideaDescendantCount,
  branchColorFor,
} from './helpers';
import { DetailPanel } from './components/detail_panel';
import { PlantForm } from './components/plant_form';
import { MindMap } from './components/mind_map';

const messages = defineMessages({
  heading: { id: 'tree.title', defaultMessage: 'Tree' },
  loading: { id: 'tree.loading', defaultMessage: 'Loading tree…' },
  empty: {
    id: 'tree.empty',
    defaultMessage: 'The tree is empty. Seed will appear when the first user visits.',
  },
  viewList: { id: 'tree.view.list', defaultMessage: 'List' },
  viewMap: { id: 'tree.view.map', defaultMessage: 'Map' },
  plantIdea: { id: 'tree.plant_idea', defaultMessage: 'Plant an idea' },
  plantLayer: {
    id: 'tree.plant_layer',
    defaultMessage: 'Add a sub-layer',
  },
});

type ViewMode = 'list' | 'map';
type PlantTarget = { parentId: string; kind: 'layer' | 'idea' } | null;

const Tree: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [_deps, setDeps] = useState<TreeDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [planting, setPlanting] = useState<PlantTarget>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchNodes(), fetchDependencies()])
      .then(([n, d]) => {
        if (cancelled) return;
        setNodes(n);
        setDeps(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load tree.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNode = selectedId
    ? nodes.find((n) => n.id === selectedId) ?? null
    : null;

  const handleNodeCreated = useCallback((node: TreeNode) => {
    setNodes((prev) => [...prev, node]);
    setPlanting(null);
  }, []);

  const handleNodeUpdated = useCallback((updated: TreeNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const handleNodeDeleted = useCallback(
    (id: string) => {
      const doomed = new Set<string>([id]);
      const collect = (parentId: string) => {
        nodes.forEach((n) => {
          if (n.parent_id === parentId && !doomed.has(n.id)) {
            doomed.add(n.id);
            collect(n.id);
          }
        });
      };
      collect(id);
      setNodes((prev) => prev.filter((n) => !doomed.has(n.id)));
      setSelectedId(null);
    },
    [nodes],
  );

  const roots = childrenOf(nodes, null);
  const root = roots[0];
  const topBranches = root ? childrenOf(nodes, root.id) : [];

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

          <div className='tree-view-toggle'>
            <button
              type='button'
              className={`tree-view-toggle__btn${mode === 'list' ? ' tree-view-toggle__btn--active' : ''}`}
              onClick={() => {
                setMode('list');
              }}
            >
              {intl.formatMessage(messages.viewList)}
            </button>
            <button
              type='button'
              className={`tree-view-toggle__btn${mode === 'map' ? ' tree-view-toggle__btn--active' : ''}`}
              onClick={() => {
                setMode('map');
              }}
            >
              {intl.formatMessage(messages.viewMap)}
            </button>
          </div>
        </header>

        {loading && (
          <div className='tree-page__loading'>
            {intl.formatMessage(messages.loading)}
          </div>
        )}

        {error && !loading && (
          <div className='tree-page__error'>{error}</div>
        )}

        {!loading && !error && topBranches.length === 0 && (
          <div className='tree-page__empty'>
            {intl.formatMessage(messages.empty)}
          </div>
        )}

        {!loading && !error && mode === 'list' && root && (
          <div className='tree-branches'>
            {topBranches.map((branch) => {
              const branchColor = branchColorFor(nodes, branch);
              const subLayers = childrenOf(nodes, branch.id);

              return (
                <section
                  key={branch.id}
                  className='tree-branch'
                  style={
                    { '--branch-color': branchColor } as React.CSSProperties
                  }
                >
                  <header
                    className='tree-branch__header'
                    onClick={() => {
                      setSelectedId(branch.id);
                    }}
                  >
                    <h3 className='tree-branch__name serif'>{branch.name}</h3>
                    {branch.description && (
                      <p className='tree-branch__tagline'>
                        {branch.description}
                      </p>
                    )}
                  </header>

                  <ul className='tree-branch__sublayers'>
                    {subLayers.map((sl) => {
                      const ideas = childrenOf(nodes, sl.id).filter(
                        (c) => c.kind === 'idea',
                      );
                      const ideaCount = ideaDescendantCount(nodes, sl.id);
                      const isPlantingHere =
                        planting?.parentId === sl.id;

                      return (
                        <li key={sl.id} className='tree-sublayer'>
                          <div
                            className='tree-sublayer__row'
                            onClick={() => {
                              setSelectedId(sl.id);
                            }}
                          >
                            <span className='tree-sublayer__name'>
                              {sl.name}
                            </span>
                            <span className='tree-sublayer__ideas-count'>
                              <FormattedMessage
                                id='tree.sublayer.ideas_count'
                                defaultMessage='{count, plural, =0 {no ideas yet} one {# idea} other {# ideas}}'
                                values={{ count: ideaCount }}
                              />
                            </span>
                          </div>

                          {ideas.length > 0 && (
                            <ul className='tree-ideas'>
                              {ideas.map((idea) => (
                                <li
                                  key={idea.id}
                                  className={`tree-idea tree-idea--${idea.status ?? 'unset'}`}
                                  onClick={() => {
                                    setSelectedId(idea.id);
                                  }}
                                >
                                  <span className='tree-idea__name'>
                                    {idea.name}
                                  </span>
                                  {idea.status && (
                                    <span
                                      className={`tree-idea__badge tree-idea__badge--${idea.status}`}
                                    >
                                      {idea.status}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          {isPlantingHere ? (
                            <PlantForm
                              parent={sl}
                              kind={planting?.kind ?? 'idea'}
                              onCreated={handleNodeCreated}
                              onCancel={() => {
                                setPlanting(null);
                              }}
                            />
                          ) : (
                            <div className='tree-sublayer__actions'>
                              <button
                                type='button'
                                className='tree-add'
                                onClick={() => {
                                  setPlanting({
                                    parentId: sl.id,
                                    kind: 'idea',
                                  });
                                }}
                              >
                                <AddIcon width={12} height={12} />
                                {intl.formatMessage(messages.plantIdea)}
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}

                    {planting?.parentId === branch.id ? (
                      <li className='tree-sublayer tree-sublayer--planting'>
                        <PlantForm
                          parent={branch}
                          kind='layer'
                          onCreated={handleNodeCreated}
                          onCancel={() => {
                            setPlanting(null);
                          }}
                        />
                      </li>
                    ) : (
                      <li className='tree-sublayer tree-sublayer--add'>
                        <button
                          type='button'
                          className='tree-add'
                          onClick={() => {
                            setPlanting({
                              parentId: branch.id,
                              kind: 'layer',
                            });
                          }}
                        >
                          <AddIcon width={12} height={12} />
                          {intl.formatMessage(messages.plantLayer)}
                        </button>
                      </li>
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {!loading && !error && mode === 'map' && root && (
          <MindMap
            nodes={nodes}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
            }}
          />
        )}

        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            nodes={nodes}
            onClose={() => {
              setSelectedId(null);
            }}
            onNodeUpdated={handleNodeUpdated}
            onNodeDeleted={handleNodeDeleted}
          />
        )}
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
