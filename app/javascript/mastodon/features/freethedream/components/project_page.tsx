import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import {
  apiFtdProject,
  apiFtdProjectAction,
  apiFtdRemoveProject,
  apiFtdSeen,
  apiFtdTurnOnSpace,
  apiFtdChat,
  FTD_SPACES,
} from 'mastodon/api/freethedream';
import { apiSpaceKuddle } from 'mastodon/api/huddle_spaces';
import type { FtdProject, FtdSpace } from 'mastodon/api_types/freethedream';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LinkifiedText } from 'mastodon/components/linkified_text';
import { PeopleRow } from 'mastodon/components/people_row';
import { useSpaceBack } from 'mastodon/components/space_back';
import { SpaceShelf } from 'mastodon/components/space_shelf';
import { KrewChat } from 'mastodon/features/krew/krew_chat';
import {
  arrangeSections,
  JumpTile,
  scrollToSection,
} from 'mastodon/features/krew/krew_detail';
import { KuddleFrame } from 'mastodon/features/live/kuddle_frame';
import { HomeKuestions } from 'mastodon/features/questions/home_kuestions';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useNamedLink } from 'mastodon/hooks/useNamedLink';

import { act } from './act';
import { Checklist } from './checklist';
import { eventMapHref, eventWhen, ProjectEvents } from './event_card';
import { GroupTiles } from './groups';
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
import { Updates } from './updates';

// A projekt, a Komponent (a gang in the code) or a fractal, on one page.
// A projekt's page is what's yours, its Komponents and a live Activity,
// with its event and talk beside them. It is part of its Krew, so it has
// no Krew row, no joining and no lists of work of its own, and Done, Hand
// over and Remove are off the page (Tal, 2026-10-30).
//
// A gang's page is its overview at a lower level (Tal, 2026-10-15): who's
// in it first, then its fractals (Kitchen → Cooking, Cleaning, Storage,
// Logistics) as a row of cards, Getting together, Activity and Talk.
// Kuestions are the projekt's, not a Komponent's (Tal, 2026-11-08). Thing Bringing, Actualise, On offer and Depends on are off the
// page, to come back as they're needed, and so is the "needs met" count
// (Tal, 2026-11-08). A fractal's page is the same without fractals of its
// own.

// Its spaces work as a Krew's do (Tal, 2026-11-09: "i really like how the
// krew setup now works"): Konnect turns one on, a tile at the top scrolls
// to it, and each is a section of its own, in the order its owner arranged
// in Edit. Only the projekt turns spaces on; a Komponent shows what it has.
const spaceSectionId = (slug: FtdSpace) => `projekt-space-${slug}`;

const messages = defineMessages({
  spaces: { id: 'freethedream.spaces', defaultMessage: 'Spaces' },
  events: { id: 'freethedream.events.title', defaultMessage: 'Events' },
  albums: { id: 'freethedream.albums.title', defaultMessage: 'Albums' },
  kronikles: {
    id: 'freethedream.kronikles.title',
    defaultMessage: 'Kronikles',
  },
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
  kuestions: { id: 'freethedream.kuestions', defaultMessage: 'Kuestions' },
  chat: { id: 'krew.detail.tile.chat', defaultMessage: 'Chat' },
  addGroup: {
    id: 'freethedream.coalesce_gang',
    defaultMessage: '+ Add a Komponent',
  },
  fractals: { id: 'freethedream.fractals', defaultMessage: 'Fractals' },
  addFractal: {
    id: 'freethedream.add_fractal',
    defaultMessage: '+ Add a fractal',
  },
  upForGrabs: {
    id: 'freethedream.up_for_grabs',
    defaultMessage:
      'Nobody is running this now. Anyone in the projekt can take it over.',
  },
});

type Composer = 'section' | 'edit' | null;

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

  const close = useCallback(() => {
    setComposer(null);
  }, []);
  const openSection = useCallback(() => {
    setComposer('section');
  }, []);
  const openEdit = useCallback(() => {
    setComposer('edit');
  }, []);

  // Opening a project or section is looking at its talk: nothing in it is
  // new to you after that.
  const isMember = project.membership === 'member';
  const frameKuestions = useCallback(
    (row: React.ReactNode) => (
      <Section title={intl.formatMessage(messages.kuestions)}>{row}</Section>
    ),
    [intl],
  );
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

  const member = project.membership === 'member';

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

  // Konnect → a space turns it on and goes to its section, New and Add
  // existing first.
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const turnOnSpace = useCallback(
    async (slug: string) => {
      // Konnect → Kuddle makes its own Kuddle, or goes to it, on a
      // Komponent's page too (docs/spaces/huddle.md, A space's own Kuddle).
      if (slug === 'huddle') {
        await apiSpaceKuddle({ project_id: project.id });
        onChange(await apiFtdProject(project.id));
        setScrollTarget('projekt-kuddle');
        return;
      }
      onChange(await apiFtdTurnOnSpace(project.id, slug));
      setScrollTarget(spaceSectionId(slug as FtdSpace));
    },
    [project.id, onChange],
  );
  useEffect(() => {
    if (!scrollTarget) return;
    const frame = requestAnimationFrame(() => {
      scrollToSection(scrollTarget);
      setScrollTarget(null);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [scrollTarget, project]);
  const spaceLabel = (slug: FtdSpace) =>
    intl.formatMessage(
      slug === 'kalendar'
        ? messages.events
        : slug === 'albutts'
          ? messages.albums
          : slug === 'kronikles'
            ? messages.kronikles
            : slug === 'nudges'
              ? messages.chat
              : messages.kuestions,
    );
  // Kuestions and its chat are the projekt's own, not a Komponent's.
  const spaces = project.spaces.filter(
    (slug) => (slug !== 'kuestions' && slug !== 'nudges') || project.top,
  );
  const hasSpace = (slug: FtdSpace) => spaces.includes(slug);

  // Its chat, in place of Talk (Tal, 2026-11-09): the projekt's own Nudges
  // group chat, read and written here as a Krew's is on its page.
  const chatOn = hasSpace('nudges') && isMember;
  const [chat, setChat] = useState<string | null>(null);
  useEffect(() => {
    setChat(null);
    if (!chatOn) return undefined;
    let cancelled = false;
    apiFtdChat(project.id)
      .then((next) => {
        if (!cancelled) setChat(next.conversation_id);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [chatOn, project.id]);
  const handleChatRead = useCallback(() => undefined, []);

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
          : [project.done && intl.formatMessage(messages.done)]
      }
    />
  );

  return (
    <KornerDetail
      className='freethedream-detail freethedream-detail--wide'
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
            <LinkifiedText text={project.description} />
          </span>
        )
      }
      meta={
        project.top ? (
          meta
        ) : (
          <>
            {meta}
            {/* Who's in it, at a glance (Tal, 2026-11-10). */}
            <PeopleRow people={project.crew.map((row) => row.account)} />
          </>
        )
      }
      actions={gangBar}
    >
      <>
        {project.top && <Yours project={project} />}
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

        {/* A Komponent's checklist first: what it needs doing and
            bringing (Tal, 2026-11-10). */}
        {!project.top && <Checklist project={project} onChange={refresh} />}

        {/* Its Komponents first, the main thing on a projekt's page (Tal,
            2026-11-09): gangs under the emergence, fractals under a gang,
            nothing under a fractal. */}
        {(project.sections.length > 0 || canAddInside) && (
          <Section
            title={intl.formatMessage(
              project.top ? messages.groups : messages.fractals,
            )}
          >
            <GroupTiles
              row
              sections={groups}
              addLabel={intl.formatMessage(
                project.top ? messages.addGroup : messages.addFractal,
              )}
              onAdd={canAddInside ? openSection : undefined}
            />
          </Section>
        )}

        {/* One column, as a Krew's page is (Tal, 2026-11-09): Talk was
            the side column's, and its chat is a section now. */}
        <div className='freethedream-layout freethedream-layout--single'>
          <div className='freethedream-layout__main'>
            {/* Its own Kuddle, a call frame at the top of the work (Tal,
                2026-10-30: "konnecting a huddle should put a frame into the
                space"). */}
            {project.kuddle_id && (
              <div id='projekt-kuddle'>
                <KuddleFrame roomId={project.kuddle_id} />
              </div>
            )}
            {/* Each space it has as its own section, then its Activity, in
                the order its owner arranged in Edit. A Komponent keeps its
                events here, with + for one of its own. */}
            {arrangeSections(project.section_order, [
              [
                'kalendar',
                (hasSpace('kalendar') || !project.top) && (
                  <ProjectEvents
                    key='kalendar'
                    id={spaceSectionId('kalendar')}
                    project={project}
                    refresh={refresh}
                  />
                ),
              ],
              [
                'albutts',
                hasSpace('albutts') && (
                  <SpaceShelf
                    key='albutts'
                    id={spaceSectionId('albutts')}
                    homeSlug='freethedream'
                    homeId={project.id}
                    korner='albutts'
                    title={intl.formatMessage(messages.albums)}
                    canAdd={project.can.edit}
                  />
                ),
              ],
              [
                'kronikles',
                hasSpace('kronikles') && (
                  <SpaceShelf
                    key='kronikles'
                    id={spaceSectionId('kronikles')}
                    homeSlug='freethedream'
                    homeId={project.id}
                    korner='kronikles'
                    title={intl.formatMessage(messages.kronikles)}
                    canAdd={project.can.edit}
                  />
                ),
              ],
              [
                'kuestions',
                hasSpace('kuestions') && (
                  <div key='kuestions' id={spaceSectionId('kuestions')}>
                    <HomeKuestions
                      home={{ kind: 'projekt', id: project.id }}
                      canAsk={isMember}
                      frame={frameKuestions}
                    />
                  </div>
                ),
              ],
              [
                'nudges',
                chat && (
                  <div key='nudges' id={spaceSectionId('nudges')}>
                    <KrewChat conversationId={chat} onRead={handleChatRead} />
                  </div>
                ),
              ],
              [
                'updates',
                <Updates
                  key='updates'
                  updates={project.updates}
                  hereId={project.id}
                  rootId={project.root.id}
                />,
              ],
            ])}
            {/* Its Konnect tiles, last, as a Krew's sit just above its posts
                (Tal, 2026-11-10): a tile for each space, scrolling to its
                section, then what it's Konnected to, then Konnect. */}
            <AttachmentSection
              korner='freethedream'
              recordId={project.id}
              canManage={project.can.edit}
              heading={
                spaces.length > 0 ? (
                  <FormattedMessage {...messages.spaces} />
                ) : undefined
              }
              leading={spaces.map((slug) => (
                <JumpTile
                  key={slug}
                  slug={slug}
                  target={spaceSectionId(slug)}
                  label={spaceLabel(slug)}
                />
              ))}
              // Its spaces' records show in their sections, a Kuddle as a call
              // frame, and a projekt lives in its Krew.
              excludeSlugs={['huddle', 'albutts', 'kronikles', ...spaces]}
              exclude={[
                ...project.events.map((e) => ({ slug: 'kalendar', id: e.id })),
                ...(project.top && project.krew
                  ? [{ slug: 'krew', id: project.krew.id }]
                  : []),
              ]}
              onTurnOnSpace={isMember ? turnOnSpace : undefined}
              turnOnSlugs={
                project.top && project.can.edit
                  ? [...FTD_SPACES, 'huddle']
                  : ['huddle']
              }
              cardsApart
            />
            {actions}
          </div>
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
    </KornerDetail>
  );
};
