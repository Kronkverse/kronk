import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, spaceColor } from 'mastodon/planets';

import type { TreeNode, TreeDependency } from './types';
import { fetchNodes, fetchDependencies } from './api';
import { childrenOf, ideaDescendantCount } from './helpers';
import { DetailPanel } from './components/detail_panel';
import { PlantForm } from './components/plant_form';
import { MindMap } from './components/mind_map';

import DigitalIcon from './icons/digital.svg?react';
import CommunityIcon from './icons/community.svg?react';
import PlatformIcon from './icons/platform.svg?react';

// Symbol per top branch — used as the visual identifier for each door
// on the landing and for the focused-branch header. Keyed on branch name
// so a real DB-side "kind" would fold into this map cleanly.
const BRANCH_ICONS: Record<
  string,
  React.FC<React.SVGProps<SVGSVGElement>>
> = {
  Digital: DigitalIcon,
  Community: CommunityIcon,
  Platform: PlatformIcon,
};

const iconFor = (
  node: TreeNode,
): React.FC<React.SVGProps<SVGSVGElement>> | null =>
  BRANCH_ICONS[node.name] ?? null;

const messages = defineMessages({
  heading: { id: 'tree.title', defaultMessage: 'Tree' },
  loading: { id: 'tree.loading', defaultMessage: 'Loading tree…' },
  empty: {
    id: 'tree.empty',
    defaultMessage:
      'The tree is empty. Seed will appear when the first user visits.',
  },
  viewList: { id: 'tree.view.list', defaultMessage: 'List' },
  viewMap: { id: 'tree.view.map', defaultMessage: 'Map' },
  plantIdea: { id: 'tree.plant_idea', defaultMessage: 'Plant an idea' },
  plantLayer: {
    id: 'tree.plant_layer',
    defaultMessage: 'Add a sub-layer',
  },
  back: {
    id: 'tree.back_to_landing',
    defaultMessage: 'Back to the three doors',
  },
});

type ViewMode = 'list' | 'map';
type PlantTarget = { parentId: string; kind: 'layer' | 'idea' } | null;

// Client-side taglines for the seeded top branches. These live here (not
// in the DB) because the seeded structure is a UI concern, not model state.
// If a branch has a real `description` set it wins over this fallback.
const BRANCH_TAGLINES: Record<string, string> = {
  Digital: 'Development · Sovereignty · Infrastructure',
  Community: 'User Experience · Relationships · Community',
  Platform: 'Governance · Structure · Vision',
};

// One-line "what happens if I enter this door" text, again client-side
// so the UI copy stays here rather than baked into the seed.
const BRANCH_INTROS: Record<string, string> = {
  Digital: 'Where Kronk gets built — code, infrastructure, sovereignty.',
  Community: 'Where Kronk feels alive — people, experience, relationships.',
  Platform: 'Where Kronk decides itself — governance, structure, vision.',
};

const taglineFor = (node: TreeNode): string =>
  node.description || BRANCH_TAGLINES[node.name] || '';

const introFor = (node: TreeNode): string =>
  BRANCH_INTROS[node.name] ?? '';

const Tree: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [_deps, setDeps] = useState<TreeDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [planting, setPlanting] = useState<PlantTarget>(null);
  // Which top branch the user has "entered". null = landing (three doors).
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);

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
  const focusedBranch =
    focusedBranchId != null
      ? topBranches.find((b) => b.id === focusedBranchId) ?? null
      : null;

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

        {/* ── List view: landing (three doors) ─────────────────────────── */}
        {!loading && !error && mode === 'list' && root && !focusedBranch && (
          <section className='tree-landing'>
            <div className='tree-landing__intro'>
              <p className='tree-eyebrow'>
                <FormattedMessage
                  id='tree.landing.eyebrow'
                  defaultMessage='Three doors'
                />
              </p>
              <h3 className='tree-landing__title serif'>
                <FormattedMessage
                  id='tree.landing.title'
                  defaultMessage='Which space are you contributing in?'
                />
              </h3>
              <p className='tree-landing__lede'>
                <FormattedMessage
                  id='tree.landing.lede'
                  defaultMessage='Kronk grows in three concurrent directions. Enter a door to see the places inside it and plant an idea.'
                />
              </p>
            </div>

            <ul className='tree-doors'>
              {topBranches.map((branch) => {
                const subLayers = childrenOf(nodes, branch.id);
                const ideaCount = ideaDescendantCount(nodes, branch.id);
                const Icon = iconFor(branch);
                const slug = branch.name.toLowerCase();

                return (
                  <li key={branch.id} className='tree-door-wrap'>
                    <button
                      type='button'
                      className={`tree-door tree-door--${slug}`}
                      onClick={() => {
                        setFocusedBranchId(branch.id);
                      }}
                    >
                      <div className='tree-door__symbol'>
                        {Icon && <Icon />}
                      </div>
                      <h4 className='tree-door__name serif'>{branch.name}</h4>
                      <p className='tree-door__tagline'>
                        {taglineFor(branch)}
                      </p>
                      <p className='tree-door__intro'>{introFor(branch)}</p>
                      <div className='tree-door__stats'>
                        <span className='tree-door__stat'>
                          <span className='tree-door__stat-value'>
                            {subLayers.length}
                          </span>
                          <span className='tree-door__stat-label'>
                            <FormattedMessage
                              id='tree.door.places'
                              defaultMessage='{count, plural, one {place} other {places}}'
                              values={{ count: subLayers.length }}
                            />
                          </span>
                        </span>
                        <span className='tree-door__stat'>
                          <span className='tree-door__stat-value'>
                            {ideaCount}
                          </span>
                          <span className='tree-door__stat-label'>
                            <FormattedMessage
                              id='tree.door.ideas'
                              defaultMessage='{count, plural, one {idea} other {ideas}}'
                              values={{ count: ideaCount }}
                            />
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── List view: focused branch ────────────────────────────────── */}
        {!loading && !error && mode === 'list' && focusedBranch && (() => {
          const FocusedIcon = iconFor(focusedBranch);
          const slug = focusedBranch.name.toLowerCase();

          return (
          <section className={`tree-focused tree-focused--${slug}`}>
            <button
              type='button'
              className='tree-back'
              onClick={() => {
                setFocusedBranchId(null);
                setPlanting(null);
              }}
            >
              <ArrowBackIcon width={14} height={14} />
              <span>{intl.formatMessage(messages.back)}</span>
            </button>

            <header className='tree-focused__header'>
              {FocusedIcon && (
                <div className='tree-focused__symbol'>
                  <FocusedIcon />
                </div>
              )}
              <div className='tree-focused__heading'>
                <p className='tree-eyebrow'>{taglineFor(focusedBranch)}</p>
                <h3 className='tree-focused__name serif'>
                  {focusedBranch.name}
                </h3>
                <p className='tree-focused__intro'>
                  {introFor(focusedBranch)}
                </p>
              </div>
            </header>

            <ul className='tree-focused__sublayers'>
              {childrenOf(nodes, focusedBranch.id).map((sl) => {
                const ideas = childrenOf(nodes, sl.id).filter(
                  (c) => c.kind === 'idea',
                );
                const ideaCount = ideaDescendantCount(nodes, sl.id);
                const isPlantingHere = planting?.parentId === sl.id;

                return (
                  <li key={sl.id} className='tree-sublayer'>
                    <div
                      className='tree-sublayer__row'
                      onClick={() => {
                        setSelectedId(sl.id);
                      }}
                    >
                      <span className='tree-sublayer__name'>{sl.name}</span>
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
                            setPlanting({ parentId: sl.id, kind: 'idea' });
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

              {planting?.parentId === focusedBranch.id ? (
                <li className='tree-sublayer tree-sublayer--planting'>
                  <PlantForm
                    parent={focusedBranch}
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
                        parentId: focusedBranch.id,
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
        })()}

        {/* ── Map view ─────────────────────────────────────────────────── */}
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
