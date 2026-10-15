import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import {
  apiFtdAddDependency,
  apiFtdHandOverProject,
  apiFtdProject,
  apiFtdProjectAction,
  apiFtdRemoveDependency,
  apiFtdRemoveProject,
  apiFtdSeen,
  apiFtdUpdateProject,
} from 'mastodon/api/freethedream';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useIdentity } from 'mastodon/identity_context';

import { Dreamers } from './dreamers';
import { eventMapHref, eventWhen } from './event_card';
import { GroupTiles } from './groups';
import { HandOver } from './hand_over';
import { ItemComposer } from './item_composer';
import { ProjectAside, Yours } from './overview';
import { ProjectComposer } from './project_composer';
import { Crumbs, Loading, ProgressLine, Section, useLoaded } from './shared';
import { Talk } from './talk';
import { Updates } from './updates';
import {
  WORK_LISTS,
  WorkBody,
  WorkCards,
  workCount,
  workMessages,
} from './work';

// A project or a section, on one page. A project's landing page is what's
// yours, its working groups, cards into each list of work (work_page.tsx),
// its Dreamers and a live Activity, with its event, joining and talk beside
// them (Tal, 2026-10-15). A section's page shows its sections and every
// list in full, with its activity and talk beside.

const messages = defineMessages({
  edit: { id: 'freethedream.edit', defaultMessage: 'Edit' },
  done: { id: 'freethedream.done', defaultMessage: 'Done' },
  joinRoot: {
    id: 'freethedream.join_root',
    defaultMessage: 'Join {title} to take part',
  },
  markDone: { id: 'freethedream.mark_done', defaultMessage: 'Mark done' },
  notDone: { id: 'freethedream.not_done', defaultMessage: 'Not done yet' },
  handOver: { id: 'freethedream.hand_over', defaultMessage: 'Hand over' },
  remove: { id: 'freethedream.remove', defaultMessage: 'Remove' },
  takeOver: { id: 'freethedream.take_over', defaultMessage: 'Take this over' },
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
  // quiet line. Nobody leads a working group, so a section shows no owner.
  const when = project.event ? eventWhen(intl, project.event) : null;
  const mapHref = project.event ? eventMapHref(project.event) : null;
  const meta = (
    <KornerMeta
      items={
        project.top
          ? [
              when && `${when.date}, ${when.time}`,
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
          : [project.done && intl.formatMessage(messages.done)]
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
        {!project.top && <ProgressLine progress={project.progress} />}
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
            {project.top ? (
              <>
                <WorkCards project={project} />
                <Dreamers
                  people={project.people}
                  count={project.members_count}
                />
                <Updates
                  updates={project.updates}
                  hereId={project.id}
                  rootId={project.root.id}
                />
              </>
            ) : (
              WORK_LISTS.filter((list) =>
                list === 'needed'
                  ? project.sections.length > 0 && project.progress.total > 0
                  : workCount(project, list) > 0 || project.can.add,
              ).map((list) => (
                <Section
                  key={list}
                  title={intl.formatMessage(workMessages[list])}
                >
                  <WorkBody
                    project={project}
                    list={list}
                    refresh={refresh}
                    onOffer={openOffer}
                  />
                </Section>
              ))
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
            {!project.top && (
              <Updates
                updates={project.updates}
                hereId={project.id}
                rootId={project.root.id}
              />
            )}
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
