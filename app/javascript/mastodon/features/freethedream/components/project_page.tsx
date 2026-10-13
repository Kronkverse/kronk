import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import {
  apiFtdAddDependency,
  apiFtdHandOverProject,
  apiFtdItemAction,
  apiFtdProject,
  apiFtdProjectAction,
  apiFtdRemoveDependency,
  apiFtdRemoveProject,
  apiFtdSeen,
  apiFtdUpdateProject,
} from 'mastodon/api/freethedream';
import type {
  FtdItemRow,
  FtdProject,
  FtdStillNeeded,
} from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useIdentity } from 'mastodon/identity_context';

import { BringControl } from './bring';
import { DATE, eventMapHref, eventWhen } from './event_card';
import { GroupTiles } from './groups';
import { HandOver } from './hand_over';
import { ItemComposer } from './item_composer';
import { ProjectAside, Yours } from './overview';
import { ProjectComposer } from './project_composer';
import { QuickAdd } from './quick_add';
import {
  Crumbs,
  Loading,
  Person,
  ProgressLine,
  Section,
  formatAmount,
  useLoaded,
} from './shared';
import { Talk } from './talk';
import { Updates } from './updates';

// A project or a section, on one page: its working groups (or sections),
// what's still needed across everything inside, the lists, updates and
// talk. A top-level project adds what's yours above the work, and its
// event, requests and people beside it (Tal, 2026-10-13: one page, no
// separate Kontribute).

const messages = defineMessages({
  edit: { id: 'freethedream.edit', defaultMessage: 'Edit' },
  done: { id: 'freethedream.done', defaultMessage: 'Done' },
  by: { id: 'freethedream.by_date', defaultMessage: 'By {date}' },
  joinRoot: {
    id: 'freethedream.join_root',
    defaultMessage: 'Join {title} to take part',
  },
  markDone: { id: 'freethedream.mark_done', defaultMessage: 'Mark done' },
  notDone: { id: 'freethedream.not_done', defaultMessage: 'Not done yet' },
  handOver: { id: 'freethedream.hand_over', defaultMessage: 'Hand over' },
  remove: { id: 'freethedream.remove', defaultMessage: 'Remove' },
  takeOver: { id: 'freethedream.take_over', defaultMessage: 'Take this over' },
  audit: { id: 'freethedream.audit', defaultMessage: 'Audit' },
  sections: { id: 'freethedream.sections', defaultMessage: 'Sections' },
  addSection: {
    id: 'freethedream.add_section',
    defaultMessage: '+ Add a section',
  },
  groups: {
    id: 'freethedream.working_groups',
    defaultMessage: 'Working groups',
  },
  addGroup: {
    id: 'freethedream.add_working_group',
    defaultMessage: '+ Add a working group',
  },
  stillNeeded: {
    id: 'freethedream.still_needed',
    defaultMessage: 'Still needed',
  },
  gear: { id: 'freethedream.gear', defaultMessage: 'Gear & supplies' },
  gearForAll: {
    id: 'freethedream.gear.for_all',
    defaultMessage: 'For all of {title}',
  },
  jobs: { id: 'freethedream.kinds.job', defaultMessage: 'Jobs' },
  ideas: { id: 'freethedream.kinds.idea', defaultMessage: 'Ideas' },
  offers: { id: 'freethedream.offers.title', defaultMessage: 'On offer' },
  offerSomething: {
    id: 'freethedream.offer_something',
    defaultMessage: '+ Offer something that isn’t on the list',
  },
  claim: { id: 'freethedream.claim', defaultMessage: 'Claim' },
  letGo: { id: 'freethedream.let_go', defaultMessage: 'Let go' },
  dependsOn: { id: 'freethedream.depends_on', defaultMessage: 'Depends on' },
  neededBy: { id: 'freethedream.needed_by', defaultMessage: 'Needed by' },
  addDependency: {
    id: 'freethedream.add_dependency',
    defaultMessage: 'Add something this depends on',
  },
  unlink: { id: 'freethedream.unlink', defaultMessage: 'Unlink' },
  removeTitle: {
    id: 'freethedream.remove_project.title',
    defaultMessage: 'Remove {title}?',
  },
  removeBody: {
    id: 'freethedream.remove_project.body',
    defaultMessage: 'It goes for everyone, with everything in it.',
  },
  upForGrabs: {
    id: 'freethedream.up_for_grabs',
    defaultMessage:
      'Nobody is running this now. Anyone in the project can take it over.',
  },
  everythingSorted: {
    id: 'freethedream.still_needed.none',
    defaultMessage: 'Nothing outstanding.',
  },
  left: { id: 'freethedream.left', defaultMessage: '{amount} left' },
  covered: { id: 'freethedream.covered', defaultMessage: 'Covered' },
  openSlots: {
    id: 'freethedream.open_slots',
    defaultMessage:
      '{count, plural, one {# person needed} other {# people needed}}',
  },
});

type Composer = 'section' | 'edit' | 'hand_over' | 'offer' | null;

// One route for both views, so switching tabs keeps the loaded project.
export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: project, failed, set } = useLoaded(id, () => apiFtdProject(id));

  if (!project) return <Loading failed={failed} />;
  return <ProjectView key={project.id} project={project} onChange={set} />;
};

const ProjectView: React.FC<{
  project: FtdProject;
  onChange: (p: FtdProject) => void;
}> = ({ project, onChange }) => {
  const intl = useIntl();
  const history = useHistory();
  const { accountId } = useIdentity();
  const [composer, setComposer] = useState<Composer>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(() => {
    void apiFtdProject(project.id).then(onChange);
  }, [project.id, onChange]);

  const close = useCallback(() => {
    setComposer(null);
  }, []);
  const openSection = useCallback(() => {
    setComposer('section');
  }, []);
  const openEdit = useCallback(() => {
    setComposer('edit');
  }, []);
  const openHandOver = useCallback(() => {
    setComposer('hand_over');
  }, []);
  const openOffer = useCallback(() => {
    setComposer('offer');
  }, []);

  // Opening a project or section is looking at its talk: nothing in it is
  // new to you after that.
  const isMember = project.membership === 'member';
  useEffect(() => {
    if (isMember) void apiFtdSeen(project.id);
  }, [isMember, project.id]);

  // Edit is on the Ж menu, owner only (docs/design.md: no inline Edit).
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    openEdit,
    project.can.edit && composer === null,
  );

  const handleTakeOver = useCallback(() => {
    void apiFtdProjectAction(project.id, 'take_over').then(onChange);
  }, [project.id, onChange]);
  const handleDone = useCallback(() => {
    void apiFtdUpdateProject(project.id, { done: !project.done }).then(
      onChange,
    );
  }, [project.id, project.done, onChange]);
  const handleHandOver = useCallback(
    (to: string) =>
      apiFtdHandOverProject(project.id, to).then((next) => {
        onChange(next);
        setComposer(null);
      }),
    [project.id, onChange],
  );

  const handleSaved = useCallback(
    (saved: FtdProject) => {
      // A new section shows up here, in the list it was added to: you stay
      // put, ready to add the next one.
      setComposer(null);
      if (saved.id === project.id) onChange(saved);
      else refresh();
    },
    [project.id, onChange, refresh],
  );
  const handleItemSaved = useCallback(() => {
    setComposer(null);
    refresh();
  }, [refresh]);

  const askRemove = useCallback(() => {
    setConfirmRemove(true);
  }, []);
  const cancelRemove = useCallback(() => {
    setConfirmRemove(false);
  }, []);
  const handleRemove = useCallback(() => {
    const parent = project.ancestors[project.ancestors.length - 1];
    void apiFtdRemoveProject(project.id).then(() => {
      history.push(
        parent ? `/hub/freethedream/p/${parent.id}` : '/hub/freethedream/mine',
      );
    });
  }, [project.id, project.ancestors, history]);

  const handleClaim = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const { id, mine } = e.currentTarget.dataset;
      if (!id) return;
      void apiFtdItemAction(id, mine === 'true' ? 'unclaim' : 'claim').then(
        refresh,
      );
    },
    [refresh],
  );

  const handleDependency = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const target = e.target.value;
      if (target) void apiFtdAddDependency(project.id, target).then(onChange);
    },
    [project.id, onChange],
  );
  const handleUnlink = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const target = e.currentTarget.dataset.id;
      if (target)
        void apiFtdRemoveDependency(project.id, target).then(onChange);
    },
    [project.id, onChange],
  );
  const member = project.membership === 'member';
  const needs = project.items.filter((i) => i.kind === 'need');
  const jobs = project.items.filter((i) => i.kind === 'job');
  const ideas = project.items.filter((i) => i.kind === 'idea');
  const offers = project.items.filter((i) => i.kind === 'offer' && !i.need);
  const linked = new Set([project.id, ...project.depends_on.map((d) => d.id)]);
  const dependencyOptions = project.all_parts.filter((p) => !linked.has(p.id));

  // The groups you have a hand in come first, tagged with any talk you
  // haven't seen in them.
  const mineById = new Map(project.mine?.groups.map((g) => [g.id, g]));
  const groups = [
    ...project.sections.filter((g) => mineById.has(g.id)),
    ...project.sections.filter((g) => !mineById.has(g.id)),
  ].map((g) => mineById.get(g.id) ?? g);
  const cover = project.cover?.url ?? project.event?.image_url;

  const goRoot = useCallback(() => {
    history.push(`/hub/freethedream/p/${project.root.id}`);
  }, [history, project.root.id]);
  const goAudit = useCallback(() => {
    history.push(`/hub/freethedream/p/${project.root.id}/audit`);
  }, [history, project.root.id]);

  const actions = (
    <KornerActionBar className='freethedream-owner-actions'>
      {!project.top && project.membership === 'none' && (
        <KornerPill
          variant='primary'
          label={intl.formatMessage(messages.joinRoot, {
            title: project.root.title,
          })}
          onClick={goRoot}
        />
      )}
      {project.can.take_over && (
        <KornerPill
          variant='primary'
          label={intl.formatMessage(messages.takeOver)}
          onClick={handleTakeOver}
        />
      )}
      {member && (
        <KornerPill
          label={intl.formatMessage(messages.audit)}
          onClick={goAudit}
        />
      )}
      {project.can.edit && (
        <KornerPill
          label={intl.formatMessage(
            project.done ? messages.notDone : messages.markDone,
          )}
          onClick={handleDone}
        />
      )}
      {project.can.hand_over && (
        <KornerPill
          label={intl.formatMessage(messages.handOver)}
          onClick={openHandOver}
        />
      )}
      {project.can.remove && (
        <KornerPill
          variant='destructive'
          label={intl.formatMessage(messages.remove)}
          onClick={askRemove}
        />
      )}
    </KornerActionBar>
  );

  // Under a project's title: what it's about, then when and where on one
  // quiet line. A section says who leads it.
  const when = project.event ? eventWhen(intl, project.event) : null;
  const mapHref = project.event ? eventMapHref(project.event) : null;
  const meta = (
    <KornerMeta
      items={
        project.top
          ? [
              when
                ? `${when.date}, ${when.time}`
                : project.ends_on &&
                  intl.formatMessage(messages.by, {
                    date: intl.formatDate(project.ends_on, {
                      ...DATE,
                      timeZone: 'UTC',
                    }),
                  }),
              project.event?.location_name &&
                (mapHref ? (
                  <Link key='where' to={mapHref}>
                    {project.event.location_name}
                  </Link>
                ) : (
                  project.event.location_name
                )),
              project.done && intl.formatMessage(messages.done),
            ]
          : [
              <Person key='owner' account={project.owner} />,
              project.done && intl.formatMessage(messages.done),
            ]
      }
    />
  );

  return (
    <KornerDetail
      className='freethedream-detail freethedream-detail--wide'
      back={
        project.top
          ? undefined
          : {
              href: `/hub/freethedream/p/${project.root.id}`,
              label: project.root.title,
            }
      }
      hero={
        project.top && cover ? (
          <div
            className='freethedream-detail__cover'
            style={{ backgroundImage: `url(${cover})` }}
          />
        ) : null
      }
      title={project.title}
      subtitle={
        project.top ? (
          project.description && (
            <span className='freethedream-detail__about'>
              {project.description}
            </span>
          )
        ) : project.ancestors.length > 1 ? (
          <Crumbs trail={project.ancestors.slice(1)} />
        ) : null
      }
      meta={meta}
    >
      <>
        {project.top && <Yours project={project} />}
        <ProgressLine progress={project.progress} />
        {(!project.top || project.source_idea) && (
          <div className='freethedream-intro'>
            {project.source_idea && (
              <p className='freethedream__quiet'>
                <FormattedMessage
                  id='freethedream.from_idea'
                  defaultMessage='Started from the idea {idea}'
                  values={{
                    idea: (
                      <Link
                        to={`/hub/freethedream/i/${project.source_idea.id}`}
                      >
                        {project.source_idea.title}
                      </Link>
                    ),
                  }}
                />
              </p>
            )}
            {!project.top && project.description && (
              <p className='freethedream-about__text'>{project.description}</p>
            )}
            {!project.top && actions}
          </div>
        )}
        {project.up_for_grabs && member && (
          <p className='freethedream__quiet'>
            {intl.formatMessage(messages.upForGrabs)}
          </p>
        )}

        {(project.sections.length > 0 || project.can.add) && (
          <Section
            title={intl.formatMessage(
              project.top ? messages.groups : messages.sections,
            )}
          >
            <GroupTiles
              sections={groups}
              addLabel={intl.formatMessage(
                project.top ? messages.addGroup : messages.addSection,
              )}
              onAdd={project.can.add ? openSection : undefined}
            />
          </Section>
        )}

        <div className='freethedream-layout'>
          <div className='freethedream-layout__main'>
            {project.sections.length > 0 && project.progress.total > 0 && (
              <Section title={intl.formatMessage(messages.stillNeeded)}>
                {project.still_needed.length === 0 ? (
                  <p className='freethedream__quiet'>
                    {intl.formatMessage(messages.everythingSorted)}
                  </p>
                ) : (
                  <ul className='freethedream-rows'>
                    {project.still_needed.map((item) => (
                      <NeededRow
                        key={item.id}
                        item={item}
                        member={member}
                        onClaim={handleClaim}
                        onChange={refresh}
                      />
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {(needs.length > 0 ||
              project.gear_inside.length > 0 ||
              project.can.add) && (
              <Section title={intl.formatMessage(messages.gear)}>
                {project.gear_inside.length > 0 && (
                  <h4 className='freethedream-section__sub'>
                    {intl.formatMessage(messages.gearForAll, {
                      title: project.title,
                    })}
                  </h4>
                )}
                {needs.length > 0 && (
                  <ul className='freethedream-rows'>
                    {needs.map((need) => (
                      <NeedRow
                        key={need.id}
                        need={need}
                        member={member}
                        onChange={refresh}
                      />
                    ))}
                  </ul>
                )}
                {project.can.add && (
                  <QuickAdd
                    kind='need'
                    projectId={project.id}
                    onAdded={refresh}
                  />
                )}
                {project.gear_inside.map((group) => (
                  <div key={group.section.id}>
                    <h4 className='freethedream-section__sub'>
                      <Link to={`/hub/freethedream/p/${group.section.id}`}>
                        {group.section.title}
                      </Link>
                    </h4>
                    <ul className='freethedream-rows'>
                      {group.items.map((need) => (
                        <NeedRow
                          key={need.id}
                          need={need}
                          member={member}
                          onChange={refresh}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </Section>
            )}

            {(jobs.length > 0 || project.can.add) && (
              <Section title={intl.formatMessage(messages.jobs)}>
                {jobs.length > 0 && (
                  <ul className='freethedream-rows'>
                    {jobs.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        member={member}
                        onClaim={handleClaim}
                      />
                    ))}
                  </ul>
                )}
                {project.can.add && (
                  <QuickAdd
                    kind='job'
                    projectId={project.id}
                    onAdded={refresh}
                  />
                )}
              </Section>
            )}

            {(ideas.length > 0 || project.can.add) && (
              <Section title={intl.formatMessage(messages.ideas)}>
                {ideas.length > 0 && (
                  <ul className='freethedream-rows'>
                    {ideas.map((idea) => (
                      <li key={idea.id}>
                        <Link
                          to={`/hub/freethedream/i/${idea.id}`}
                          className='freethedream-row'
                        >
                          <span className='freethedream-row__title'>
                            {idea.title}
                          </span>
                          <span className='freethedream-row__meta'>
                            {idea.owner?.display_name}
                            {idea.taken_on && (
                              <>
                                {' · '}
                                <FormattedMessage
                                  id='freethedream.became'
                                  defaultMessage='Now {link}'
                                  values={{ link: idea.taken_on.title }}
                                />
                              </>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {project.can.add && (
                  <QuickAdd
                    kind='idea'
                    projectId={project.id}
                    onAdded={refresh}
                  />
                )}
              </Section>
            )}

            {(offers.length > 0 || project.can.add) && (
              <Section title={intl.formatMessage(messages.offers)}>
                {offers.length > 0 && (
                  <ul className='freethedream-rows'>
                    {offers.map((offer) => (
                      <li key={offer.id}>
                        <Link
                          to={`/hub/freethedream/i/${offer.id}`}
                          className='freethedream-row'
                        >
                          <span className='freethedream-row__title'>
                            {offer.title}
                            {(offer.quantity > 1 || offer.unit) && (
                              <span className='freethedream-row__count'>
                                {formatAmount(offer.quantity, offer.unit)}
                              </span>
                            )}
                          </span>
                          <span className='freethedream-row__meta'>
                            {offer.owner?.display_name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {project.can.add && (
                  <button
                    type='button'
                    className='freethedream__link freethedream-section__more'
                    onClick={openOffer}
                  >
                    {intl.formatMessage(messages.offerSomething)}
                  </button>
                )}
              </Section>
            )}

            {(project.depends_on.length > 0 ||
              project.needed_by.length > 0 ||
              (member && !project.top && dependencyOptions.length > 0)) && (
              <Section title={intl.formatMessage(messages.dependsOn)}>
                {project.depends_on.length > 0 && (
                  <ul className='freethedream-links'>
                    {project.depends_on.map((d) => (
                      <li key={d.id}>
                        <Link to={`/hub/freethedream/p/${d.id}`}>
                          {d.title}
                        </Link>
                        {project.can.edit && (
                          <button
                            type='button'
                            className='freethedream__link'
                            data-id={d.id}
                            onClick={handleUnlink}
                          >
                            {intl.formatMessage(messages.unlink)}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {member && !project.top && dependencyOptions.length > 0 && (
                  <select
                    className='freethedream__input freethedream__input--inline'
                    value=''
                    onChange={handleDependency}
                    aria-label={intl.formatMessage(messages.addDependency)}
                  >
                    <option value=''>
                      {intl.formatMessage(messages.addDependency)}
                    </option>
                    {dependencyOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {'  '.repeat(p.depth)}
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
                {project.needed_by.length > 0 && (
                  <p className='freethedream__quiet'>
                    {intl.formatMessage(messages.neededBy)}{' '}
                    {project.needed_by.map((d, i) => (
                      <span key={d.id}>
                        {i > 0 && ', '}
                        <Link to={`/hub/freethedream/p/${d.id}`}>
                          {d.title}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </Section>
            )}
          </div>
          <aside className='freethedream-layout__aside'>
            {project.top && (
              <ProjectAside
                project={project}
                onChange={onChange}
                refresh={refresh}
              />
            )}
            <Updates updates={project.updates} hereId={project.id} />
            <Talk
              subjectType='project'
              subjectId={project.id}
              comments={project.comments}
              canComment={project.can.comment}
            />
            {project.top && actions}
          </aside>
        </div>
      </>

      {composer === 'section' && (
        <ProjectComposer
          parent={project}
          onCancel={close}
          onSaved={handleSaved}
        />
      )}
      {composer === 'edit' && (
        <ProjectComposer
          editing={project}
          onCancel={close}
          onSaved={handleSaved}
        />
      )}
      {composer === 'offer' && (
        <ItemComposer
          kind='offer'
          project={project}
          onCancel={close}
          onSaved={handleItemSaved}
        />
      )}
      {composer === 'hand_over' && (
        <HandOver
          rootId={project.root.id}
          title={project.title}
          selfId={accountId}
          onHandOver={handleHandOver}
          onCancel={close}
        />
      )}
      {confirmRemove && (
        <ConfirmDialog
          title={intl.formatMessage(messages.removeTitle, {
            title: project.title,
          })}
          message={intl.formatMessage(messages.removeBody)}
          confirmLabel={intl.formatMessage(messages.remove)}
          destructive
          onConfirm={handleRemove}
          onCancel={cancelRemove}
        />
      )}
    </KornerDetail>
  );
};

// Who's bringing what, then what's left: "Sam 12 · Jo 14 · 4 left".
const Contributors: React.FC<{ need: FtdItemRow }> = ({ need }) => {
  const intl = useIntl();
  const left = need.left ?? 0;
  return (
    <span className='freethedream-row__meta'>
      {(need.contributors ?? []).map((c) => (
        <span key={c.offer_id} className='freethedream-contrib'>
          {c.account?.display_name} {formatAmount(c.quantity, need.unit)}
        </span>
      ))}
      <span className='freethedream-contrib'>
        {left > 0
          ? intl.formatMessage(messages.left, {
              amount: formatAmount(left, need.unit),
            })
          : intl.formatMessage(messages.covered)}
      </span>
    </span>
  );
};

// A need in this section's list: the full amount, who's bringing what,
// and your Bring.
const NeedRow: React.FC<{
  need: FtdItemRow;
  member: boolean;
  onChange: () => void;
}> = ({ need, member, onChange }) => (
  <li className='freethedream-row freethedream-row--item'>
    <Link
      to={`/hub/freethedream/i/${need.id}`}
      className='freethedream-row__main'
    >
      <span className='freethedream-row__title'>
        {need.title}
        <span className='freethedream-row__count'>
          {formatAmount(need.quantity, need.unit)}
        </span>
        {(need.spare ?? 0) > 0 && (
          <span className='freethedream-tag'>
            <FormattedMessage
              id='freethedream.spare'
              defaultMessage='{count} spare'
              values={{ count: need.spare }}
            />
          </span>
        )}
      </span>
      <Contributors need={need} />
    </Link>
    {member && (
      <span className='freethedream-row__side'>
        <BringControl need={need} onChange={onChange} />
      </span>
    )}
  </li>
);

const JobRow: React.FC<{
  job: FtdItemRow;
  member: boolean;
  onClaim: (e: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ job, member, onClaim }) => {
  const intl = useIntl();
  const full = (job.claimed ?? 0) >= job.quantity;
  const names = (job.claimers ?? [])
    .map((a) => a?.display_name)
    .filter(Boolean);
  return (
    <li className='freethedream-row freethedream-row--item'>
      <Link
        to={`/hub/freethedream/i/${job.id}`}
        className='freethedream-row__main'
      >
        <span className='freethedream-row__title'>{job.title}</span>
        <span className='freethedream-row__meta'>
          {names.length > 0 && `${names.join(', ')} · `}
          {full
            ? intl.formatMessage(messages.covered)
            : intl.formatMessage(messages.openSlots, {
                count: job.quantity - (job.claimed ?? 0),
              })}
        </span>
      </Link>
      {member && (job.claimed_by_me || !full) && (
        <span className='freethedream-row__side'>
          <button
            type='button'
            className={
              job.claimed_by_me
                ? 'freethedream__link'
                : 'freethedream__button freethedream__button--small'
            }
            data-id={job.id}
            data-mine={job.claimed_by_me ? 'true' : 'false'}
            onClick={onClaim}
          >
            {intl.formatMessage(
              job.claimed_by_me ? messages.letGo : messages.claim,
            )}
          </button>
        </span>
      )}
    </li>
  );
};

// A row in Still needed: what's left, which section it's in, one tap to
// bring or claim.
const NeededRow: React.FC<{
  item: FtdStillNeeded;
  member: boolean;
  onClaim: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onChange: () => void;
}> = ({ item, member, onClaim, onChange }) => {
  const intl = useIntl();
  if (item.kind === 'job')
    return (
      <li className='freethedream-row freethedream-row--item'>
        <Link
          to={`/hub/freethedream/i/${item.id}`}
          className='freethedream-row__main'
        >
          <span className='freethedream-row__title'>{item.title}</span>
          <span className='freethedream-row__meta'>
            {item.section && `${item.section.title} · `}
            {intl.formatMessage(messages.openSlots, {
              count: item.quantity - (item.claimed ?? 0),
            })}
          </span>
        </Link>
        {member && (
          <span className='freethedream-row__side'>
            <button
              type='button'
              className={
                item.claimed_by_me
                  ? 'freethedream__link'
                  : 'freethedream__button freethedream__button--small'
              }
              data-id={item.id}
              data-mine={item.claimed_by_me ? 'true' : 'false'}
              onClick={onClaim}
            >
              {intl.formatMessage(
                item.claimed_by_me ? messages.letGo : messages.claim,
              )}
            </button>
          </span>
        )}
      </li>
    );

  return (
    <li className='freethedream-row freethedream-row--item'>
      <Link
        to={`/hub/freethedream/i/${item.id}`}
        className='freethedream-row__main'
      >
        <span className='freethedream-row__title'>{item.title}</span>
        <span className='freethedream-row__meta'>
          {item.section && `${item.section.title} · `}
          {intl.formatMessage(messages.left, {
            amount: formatAmount(item.left ?? item.quantity, item.unit),
          })}
        </span>
      </Link>
      {member && (
        <span className='freethedream-row__side'>
          <BringControl need={item} onChange={onChange} />
        </span>
      )}
    </li>
  );
};
