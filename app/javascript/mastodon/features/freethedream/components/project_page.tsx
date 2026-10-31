import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useLocation, useParams } from 'react-router-dom';

import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiDeleteAttachment } from 'mastodon/api/attachments';
import type { ApiAttachmentJSON } from 'mastodon/api/attachments';
import {
  apiFtdAddDependency,
  apiFtdProject,
  apiFtdProjectAction,
  apiFtdRemoveDependency,
  apiFtdRemoveProject,
  apiFtdSeen,
} from 'mastodon/api/freethedream';
import type {
  FtdProject,
  FtdQuotedItem,
} from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useSpaceBack } from 'mastodon/components/space_back';
import { KuddleFrame } from 'mastodon/features/live/kuddle_frame';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useNamedLink } from 'mastodon/hooks/useNamedLink';

import { act } from './act';
import { Crew } from './crew';
import { eventMapHref, eventWhen, GettingTogether } from './event_card';
import { GroupTiles } from './groups';
import { ItemComposer } from './item_composer';
import { Yours } from './overview';
import { ProjectComposer } from './project_composer';
import {
  itemPath,
  Loading,
  projectPath,
  Section,
  useKrewAddress,
  useLoaded,
} from './shared';
import { Talk } from './talk';
import { Updates } from './updates';
import { WORK_LISTS, WorkBody, workCount, workMessages } from './work';

// A projekt, a Komponent (a gang in the code) or a fractal, on one page.
// A projekt's page is what's yours, its Komponents and a live Activity,
// with its event and talk beside them. It is part of its Krew, so it has
// no Krew row, no joining and no lists of work of its own, and Done, Hand
// over and Remove are off the page (Tal, 2026-10-30).
//
// A gang's page is its overview at a lower level (Tal, 2026-10-15): who's
// in it first (and what each is bringing or actualising), how much gear is
// gathered, its fractals (Kitchen → Cooking, Cleaning, Storage,
// Logistics) as tiles, then Thing Bringing, Actualise and On offer in
// full, each grouped by fractal, with one tap to bring or jump on board.
// A fractal's page is the same without fractals of its own.

const messages = defineMessages({
  edit: { id: 'freethedream.edit', defaultMessage: 'Edit' },
  remove: { id: 'freethedream.remove', defaultMessage: 'Remove' },
  removeTitle: {
    id: 'freethedream.remove_project.title',
    defaultMessage: 'Remove {title}?',
  },
  removeBody: {
    id: 'freethedream.remove_project.body',
    defaultMessage: 'It goes for everyone, with everything in it.',
  },
  done: { id: 'freethedream.done', defaultMessage: 'Done' },
  joinRoot: {
    id: 'freethedream.join_root',
    defaultMessage: 'Join {title} to take part',
  },
  takeOver: { id: 'freethedream.take_over', defaultMessage: 'Take this over' },
  joinGang: { id: 'freethedream.gang.join', defaultMessage: 'Join' },
  joinedGang: { id: 'freethedream.gang.joined', defaultMessage: 'Joined' },
  joinGangAria: {
    id: 'freethedream.gang.join_aria',
    defaultMessage: 'Join {title}, to hear about its talk and what is added',
  },
  leaveGangAria: {
    id: 'freethedream.gang.leave_aria',
    defaultMessage: 'You joined {title}. Press to leave it.',
  },
  joinGangHint: {
    id: 'freethedream.gang.join_hint',
    defaultMessage: 'Join to hear when people talk or add things here.',
  },
  joinedGangHint: {
    id: 'freethedream.gang.joined_hint',
    defaultMessage: 'You hear when people talk or add things here.',
  },
  groups: { id: 'freethedream.gangs', defaultMessage: 'Komponents' },
  addGroup: {
    id: 'freethedream.coalesce_gang',
    defaultMessage: '+ Add a Komponent',
  },
  fractals: { id: 'freethedream.fractals', defaultMessage: 'Fractals' },
  addFractal: {
    id: 'freethedream.add_fractal',
    defaultMessage: '+ Add a fractal',
  },
  gearGathered: {
    id: 'freethedream.gear_gathered',
    defaultMessage: '{gathered} of {total} needs met',
  },
  dependsOn: { id: 'freethedream.depends_on', defaultMessage: 'Depends on' },
  neededBy: { id: 'freethedream.needed_by', defaultMessage: 'Needed by' },
  addDependency: {
    id: 'freethedream.add_dependency',
    defaultMessage: 'Add something this depends on',
  },
  unlink: { id: 'freethedream.unlink', defaultMessage: 'Unlink' },
  upForGrabs: {
    id: 'freethedream.up_for_grabs',
    defaultMessage:
      'Nobody is running this now. Anyone in the projekt can take it over.',
  },
});

type Composer = 'section' | 'edit' | 'offer' | null;

// One route for both views, so switching tabs keeps the loaded project.
export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: project, failed, set } = useLoaded(id, () => apiFtdProject(id));
  useNamedLink(id, project?.slug);

  if (!project) return <Loading failed={failed} />;
  return <ProjectView key={project.id} project={project} onChange={set} />;
};

const ProjectView: React.FC<{
  project: FtdProject;
  onChange: (p: FtdProject) => void;
}> = ({ project, onChange }) => {
  const intl = useIntl();
  const history = useHistory();
  const [composer, setComposer] = useState<Composer>(null);

  const refresh = useCallback(() => {
    void act(apiFtdProject(project.id).then(onChange));
  }, [project.id, onChange]);

  // "Talk about it" on a thing on the list lands here with ?quote=<item>,
  // and Talk opens a thread about it.
  const { pathname, search } = useLocation();
  const quoteId = new URLSearchParams(search).get('quote');
  const quote: FtdQuotedItem | null = quoteId
    ? ([
        ...project.items,
        ...project.inside.flatMap((g) => g.items),
        ...project.still_needed,
      ].find((item) => item.id === quoteId) ?? null)
    : null;
  const clearQuote = useCallback(() => {
    history.replace(pathname);
  }, [history, pathname]);

  const close = useCallback(() => {
    setComposer(null);
  }, []);
  const openSection = useCallback(() => {
    setComposer('section');
  }, []);
  const openEdit = useCallback(() => {
    setComposer('edit');
  }, []);
  const openOffer = useCallback(() => {
    setComposer('offer');
  }, []);

  // Opening a project or section is looking at its talk: nothing in it is
  // new to you after that.
  const isMember = project.membership === 'member';
  useEffect(() => {
    if (isMember) void act(apiFtdSeen(project.id));
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

  // Remove, for a Komponent or fractal, on the Ж menu beside Edit (Tal,
  // 2026-10-31). The server still refuses while others have things in it.
  const [confirmRemove, setConfirmRemove] = useState(false);
  const askRemove = useCallback(() => {
    setConfirmRemove(true);
  }, []);
  const cancelRemove = useCallback(() => {
    setConfirmRemove(false);
  }, []);
  const removeParent = project.ancestors[project.ancestors.length - 1];
  const handleRemove = useCallback(() => {
    setConfirmRemove(false);
    void act(
      apiFtdRemoveProject(project.id).then(() => {
        if (removeParent) history.push(projectPath(removeParent));
      }),
    );
  }, [project.id, removeParent, history]);
  useRegisterPageAction(
    {
      key: 'remove',
      label: intl.formatMessage(messages.remove),
      icon: DeleteIcon,
      iconId: 'delete',
    },
    askRemove,
    !project.top && project.can.remove && composer === null,
  );

  // Joining a Komponent is how you hear about it (Tal, 2026-10-30: "the
  // UX for joining should be simple and intuitive"): one pill at the top,
  // Join, then Joined, which leaves again.
  const handleGang = useCallback(() => {
    void act(
      apiFtdProjectAction(
        project.id,
        project.in_gang ? 'leave_gang' : 'join_gang',
      ).then(onChange),
    );
  }, [project.id, project.in_gang, onChange]);

  const handleTakeOver = useCallback(() => {
    void act(apiFtdProjectAction(project.id, 'take_over').then(onChange));
  }, [project.id, onChange]);

  const handleSaved = useCallback(
    (saved: FtdProject) => {
      // A new gang shows up here, among the others: you stay put, ready to
      // coalesce the next one.
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

  const handleDependency = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const target = e.target.value;
      if (target)
        void act(apiFtdAddDependency(project.id, target).then(onChange));
    },
    [project.id, onChange],
  );
  const handleUnlink = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const target = e.currentTarget.dataset.id;
      if (target)
        void act(apiFtdRemoveDependency(project.id, target).then(onChange));
    },
    [project.id, onChange],
  );
  const member = project.membership === 'member';
  const linked = new Set([project.id, ...project.depends_on.map((d) => d.id)]);
  const dependencyOptions = project.all_parts.filter((p) => !linked.has(p.id));

  // The gangs you have a hand in come first, tagged with any talk you
  // haven't seen in them.
  const mineById = new Map(project.mine?.groups.map((g) => [g.id, g]));
  const groups = [
    ...project.sections.filter((g) => mineById.has(g.id)),
    ...project.sections.filter((g) => !mineById.has(g.id)),
  ].map((g) => mineById.get(g.id) ?? g);
  const cover = project.cover?.url ?? project.event?.image_url;
  useKrewAddress(project.krew?.slug);
  // The space badge goes one layer up: a gang's to the projekt, a
  // fractal's to its gang, and a projekt's to the Krew it lives in (Tal,
  // 2026-10-30).
  const parent = project.ancestors[project.ancestors.length - 1];
  const krew = project.krew;
  useSpaceBack(
    parent
      ? { href: projectPath(parent), label: parent.title }
      : krew
        ? { href: `/hub/krew/${krew.slug}`, label: krew.name }
        : null,
  );
  const canAddInside = project.level !== 'fractal' && project.can.add;

  // Kuddles Konnected here show as call frames at the top of the work, not
  // as tiles (Tal, 2026-10-30: "konnecting a huddle should put a frame
  // into the space"). Attached reports its Konnections, so a new one shows
  // at once.
  const [kuddles, setKuddles] = useState<{ room: string; link: string }[]>([]);
  const handleKonnections = useCallback((rows: ApiAttachmentJSON[]) => {
    const seen = new Set<string>();
    setKuddles(
      rows.flatMap((row) => {
        const room =
          row.target_slug === 'huddle'
            ? row.target_id
            : row.source_slug === 'huddle'
              ? row.source_id
              : null;
        if (!room || seen.has(room)) return [];
        seen.add(room);
        return [{ room, link: row.id }];
      }),
    );
  }, []);
  const handleDiskonnect = useCallback((link: string) => {
    void act(
      apiDeleteAttachment(link).then(() => {
        setKuddles((current) => current.filter((k) => k.link !== link));
      }),
    );
  }, []);

  const goRoot = useCallback(() => {
    history.push(projectPath(project.root));
  }, [history, project.root]);

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
    </KornerActionBar>
  );

  const gangBar =
    project.level === 'gang' && (project.can.join_gang || project.in_gang) ? (
      <div className='freethedream-join-gang'>
        <KornerPill
          variant={project.in_gang ? 'default' : 'primary'}
          active={project.in_gang}
          label={intl.formatMessage(
            project.in_gang ? messages.joinedGang : messages.joinGang,
          )}
          ariaLabel={intl.formatMessage(
            project.in_gang ? messages.leaveGangAria : messages.joinGangAria,
            { title: project.title },
          )}
          onClick={handleGang}
        />
        <span className='freethedream__quiet'>
          {intl.formatMessage(
            project.in_gang ? messages.joinedGangHint : messages.joinGangHint,
          )}
        </span>
      </div>
    ) : null;

  // Under an emergence's title: what it's about, then when and where on
  // one quiet line. Nobody leads a gang, so a gang shows no owner.
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
          : [
              project.gear.total > 0 &&
                intl.formatMessage(messages.gearGathered, project.gear),
              project.done && intl.formatMessage(messages.done),
            ]
      }
    />
  );

  return (
    <KornerDetail
      className='freethedream-detail freethedream-detail--wide'
      attached={{
        korner: 'freethedream',
        id: project.id,
        canManage: project.can.edit,
        excludeSlugs: ['huddle'],
        onKonnections: handleKonnections,
        // Getting together already lists the linked events, and a projekt
        // lives in its Krew.
        exclude: [
          ...project.events.map((e) => ({ slug: 'kalendar', id: e.id })),
          ...(project.top && project.krew
            ? [{ slug: 'krew', id: project.krew.id }]
            : []),
        ],
      }}
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
        project.description && (
          <span className='freethedream-detail__about'>
            {project.description}
          </span>
        )
      }
      meta={meta}
      actions={gangBar}
    >
      <>
        {project.top ? (
          <Yours project={project} />
        ) : (
          <Crew crew={project.crew} />
        )}
        {project.source_idea && (
          <div className='freethedream-intro'>
            <p className='freethedream__quiet'>
              <FormattedMessage
                id='freethedream.from_idea'
                defaultMessage='Started from the idea {idea}'
                values={{
                  idea: (
                    <Link to={itemPath(project.source_idea)}>
                      {project.source_idea.title}
                    </Link>
                  ),
                }}
              />
            </p>
          </div>
        )}
        {project.up_for_grabs && member && (
          <p className='freethedream__quiet'>
            {intl.formatMessage(messages.upForGrabs)}
          </p>
        )}

        {/* Gangs under the emergence, fractals under a gang, nothing under
            a fractal. */}
        {(project.sections.length > 0 || canAddInside) && (
          <Section
            title={intl.formatMessage(
              project.top ? messages.groups : messages.fractals,
            )}
          >
            <GroupTiles
              sections={groups}
              addLabel={intl.formatMessage(
                project.top ? messages.addGroup : messages.addFractal,
              )}
              onAdd={canAddInside ? openSection : undefined}
            />
          </Section>
        )}

        <div className='freethedream-layout'>
          <div className='freethedream-layout__main'>
            {kuddles.map((k) => (
              <KuddleFrame
                key={k.room}
                roomId={k.room}
                link={k.link}
                onDiskonnect={project.can.edit ? handleDiskonnect : undefined}
              />
            ))}
            {project.top ? (
              <Updates
                updates={project.updates}
                hereId={project.id}
                rootId={project.root.id}
              />
            ) : (
              // Every list in full, grouped by fractal. Still needed isn't
              // here: each row already says whether anyone is on it.
              WORK_LISTS.filter(
                (list) =>
                  list !== 'needed' &&
                  (workCount(project, list) > 0 || project.can.add),
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
                        <Link to={projectPath(d)}>{d.title}</Link>
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
                        <Link to={projectPath(d)}>{d.title}</Link>
                      </span>
                    ))}
                  </p>
                )}
              </Section>
            )}
          </div>
          <aside className='freethedream-layout__aside'>
            <GettingTogether project={project} refresh={refresh} />
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
              emergenceId={project.root.id}
              comments={project.comments}
              canComment={project.can.comment}
              quote={quote}
              onQuoteDone={clearQuote}
            />
            {actions}
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
      {composer === 'offer' && (
        <ItemComposer
          kind='offer'
          project={project}
          onCancel={close}
          onSaved={handleItemSaved}
        />
      )}
    </KornerDetail>
  );
};
