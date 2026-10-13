import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import {
  apiFtdAddDependency,
  apiFtdAnswerRequest,
  apiFtdHandOverProject,
  apiFtdItemAction,
  apiFtdProject,
  apiFtdProjectAction,
  apiFtdRemoveDependency,
  apiFtdRemoveProject,
  apiFtdUpdateProject,
} from 'mastodon/api/freethedream';
import type {
  FtdItemKind,
  FtdItemRow,
  FtdProject,
} from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { useIdentity } from 'mastodon/identity_context';

import { HandOver } from './hand_over';
import { ItemComposer } from './item_composer';
import { ProjectComposer } from './project_composer';
import {
  Comments,
  Crumbs,
  KINDS,
  Loading,
  People,
  Person,
  Progress,
  Section,
  categoryMessages,
  kindMessages,
  kindPluralMessages,
  useLoaded,
} from './shared';

const messages = defineMessages({
  join: { id: 'freethedream.join', defaultMessage: 'Join' },
  ask: { id: 'freethedream.ask', defaultMessage: 'Ask to join' },
  asked: { id: 'freethedream.asked', defaultMessage: 'Asked · Withdraw' },
  leave: { id: 'freethedream.leave', defaultMessage: 'Leave' },
  edit: { id: 'freethedream.edit', defaultMessage: 'Edit' },
  markDone: { id: 'freethedream.mark_done', defaultMessage: 'Mark done' },
  notDone: { id: 'freethedream.not_done', defaultMessage: 'Not done yet' },
  handOver: { id: 'freethedream.hand_over', defaultMessage: 'Hand over' },
  remove: { id: 'freethedream.remove', defaultMessage: 'Remove' },
  takeOver: { id: 'freethedream.take_over', defaultMessage: 'Take this over' },
  audit: { id: 'freethedream.audit', defaultMessage: 'Audit' },
  part: { id: 'freethedream.kind.part', defaultMessage: 'Part' },
  parts: { id: 'freethedream.kinds.part', defaultMessage: 'Parts' },
  add: { id: 'freethedream.add', defaultMessage: 'Add' },
  claim: { id: 'freethedream.claim', defaultMessage: 'Claim' },
  letGo: { id: 'freethedream.let_go', defaultMessage: 'Let go' },
  dependsOn: { id: 'freethedream.depends_on', defaultMessage: 'Depends on' },
  neededBy: { id: 'freethedream.needed_by', defaultMessage: 'Needed by' },
  addDependency: {
    id: 'freethedream.add_dependency',
    defaultMessage: 'Add something this depends on',
  },
  unlink: { id: 'freethedream.unlink', defaultMessage: 'Unlink' },
  people: { id: 'freethedream.people', defaultMessage: 'People' },
  requests: { id: 'freethedream.requests', defaultMessage: 'Asking to join' },
  accept: { id: 'freethedream.accept', defaultMessage: 'Accept' },
  notNow: { id: 'freethedream.not_now', defaultMessage: 'Not now' },
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

type Composer =
  | { type: 'part' }
  | { type: 'item'; kind: FtdItemKind }
  | { type: 'edit' }
  | { type: 'hand_over' }
  | null;

const formatDay = (intl: ReturnType<typeof useIntl>, day: string) =>
  intl.formatDate(day, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

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

  const closeComposer = useCallback(() => {
    setComposer(null);
  }, []);

  const handleMembership = useCallback(() => {
    const action = project.membership === 'none' ? 'join' : 'leave';
    void apiFtdProjectAction(project.id, action).then(onChange);
  }, [project.id, project.membership, onChange]);

  const handleTakeOver = useCallback(() => {
    void apiFtdProjectAction(project.id, 'take_over').then(onChange);
  }, [project.id, onChange]);

  const handleDone = useCallback(() => {
    void apiFtdUpdateProject(project.id, { done: !project.done }).then(
      onChange,
    );
  }, [project.id, project.done, onChange]);

  const handleAdd = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const kind = e.currentTarget.dataset.kind;
    if (kind === 'part') setComposer({ type: 'part' });
    else if (kind && (KINDS as string[]).includes(kind))
      setComposer({ type: 'item', kind: kind as FtdItemKind });
  }, []);

  const handleEdit = useCallback(() => {
    setComposer({ type: 'edit' });
  }, []);
  const handleHandOverOpen = useCallback(() => {
    setComposer({ type: 'hand_over' });
  }, []);
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
      setComposer(null);
      if (saved.id === project.id) onChange(saved);
      else history.push(`/hub/freethedream/p/${saved.id}`);
    },
    [project.id, onChange, history],
  );

  const handleItemSaved = useCallback(() => {
    setComposer(null);
    refresh();
  }, [refresh]);

  const handleRemoveAsk = useCallback(() => {
    setConfirmRemove(true);
  }, []);
  const handleRemoveCancel = useCallback(() => {
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
      if (!target) return;
      void apiFtdAddDependency(project.id, target).then(onChange);
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

  const handleAnswer = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const { id, answer } = e.currentTarget.dataset;
      if (!id) return;
      void apiFtdAnswerRequest(
        project.id,
        id,
        answer === 'accept' ? 'accept' : 'decline',
      ).then(onChange);
    },
    [project.id, onChange],
  );

  const byKind = (kind: FtdItemKind) =>
    project.items.filter((item) => item.kind === kind);
  const member = project.membership === 'member';
  const linked = new Set([project.id, ...project.depends_on.map((d) => d.id)]);
  const dependencyOptions = project.all_parts.filter((p) => !linked.has(p.id));

  const membershipLabel =
    project.membership === 'member'
      ? messages.leave
      : project.membership === 'requested'
        ? messages.asked
        : project.joining === 'open'
          ? messages.join
          : messages.ask;

  return (
    <div className='freethedream-page'>
      <Crumbs trail={project.ancestors} />

      <header className='freethedream-page__head'>
        <h2 className='freethedream-page__title'>{project.title}</h2>
        <div className='freethedream-page__meta'>
          <Person account={project.owner} />
          {project.ends_on && <span>{formatDay(intl, project.ends_on)}</span>}
          {project.done && (
            <span className='freethedream-tag'>
              <FormattedMessage id='freethedream.done' defaultMessage='Done' />
            </span>
          )}
          <span>
            <FormattedMessage
              id='freethedream.members_count'
              defaultMessage='{count, plural, one {# person} other {# people}}'
              values={{ count: project.members_count }}
            />
          </span>
        </div>
        {project.source_idea && (
          <p className='freethedream__quiet'>
            <FormattedMessage
              id='freethedream.from_idea'
              defaultMessage='Started from the idea {idea}'
              values={{
                idea: (
                  <Link to={`/hub/freethedream/i/${project.source_idea.id}`}>
                    {project.source_idea.title}
                  </Link>
                ),
              }}
            />
          </p>
        )}
        {project.description && (
          <p className='freethedream-page__body'>{project.description}</p>
        )}
      </header>

      <div className='freethedream-actions'>
        {project.top && (
          <button
            type='button'
            className={
              member
                ? 'freethedream__button freethedream__button--quiet'
                : 'freethedream__button'
            }
            onClick={handleMembership}
          >
            {intl.formatMessage(membershipLabel)}
          </button>
        )}
        {!project.top && project.membership === 'none' && (
          <Link
            to={`/hub/freethedream/p/${project.root.id}`}
            className='freethedream__button'
          >
            <FormattedMessage
              id='freethedream.join_root'
              defaultMessage='Join {title} to take part'
              values={{ title: project.root.title }}
            />
          </Link>
        )}
        {member && (
          <Link
            to={`/hub/freethedream/p/${project.root.id}/audit`}
            className='freethedream__button freethedream__button--quiet'
          >
            {intl.formatMessage(messages.audit)}
          </Link>
        )}
        {project.can.take_over && (
          <button
            type='button'
            className='freethedream__button'
            onClick={handleTakeOver}
          >
            {intl.formatMessage(messages.takeOver)}
          </button>
        )}
        {project.can.edit && (
          <>
            <button
              type='button'
              className='freethedream__link'
              onClick={handleEdit}
            >
              {intl.formatMessage(messages.edit)}
            </button>
            <button
              type='button'
              className='freethedream__link'
              onClick={handleDone}
            >
              {intl.formatMessage(
                project.done ? messages.notDone : messages.markDone,
              )}
            </button>
          </>
        )}
        {project.can.hand_over && (
          <button
            type='button'
            className='freethedream__link'
            onClick={handleHandOverOpen}
          >
            {intl.formatMessage(messages.handOver)}
          </button>
        )}
        {project.can.remove && (
          <button
            type='button'
            className='freethedream__link freethedream__link--danger'
            onClick={handleRemoveAsk}
          >
            {intl.formatMessage(messages.remove)}
          </button>
        )}
      </div>

      {project.up_for_grabs && member && (
        <p className='freethedream__quiet'>
          {intl.formatMessage(messages.upForGrabs)}
        </p>
      )}

      {project.can.add && (
        <div className='freethedream-add'>
          <span className='freethedream-add__label'>
            {intl.formatMessage(messages.add)}
          </span>
          <button
            type='button'
            className='freethedream-chip'
            data-kind='part'
            onClick={handleAdd}
          >
            {intl.formatMessage(messages.part)}
          </button>
          {KINDS.map((kind) => (
            <button
              key={kind}
              type='button'
              className='freethedream-chip'
              data-kind={kind}
              onClick={handleAdd}
            >
              {intl.formatMessage(kindMessages[kind])}
            </button>
          ))}
        </div>
      )}

      {project.parts.length > 0 && (
        <Section title={intl.formatMessage(messages.parts)}>
          <ul className='freethedream-rows'>
            {project.parts.map((part) => (
              <li key={part.id}>
                <Link
                  to={`/hub/freethedream/p/${part.id}`}
                  className='freethedream-row'
                >
                  <span className='freethedream-row__title'>
                    {part.title}
                    {part.done && (
                      <span className='freethedream-tag'>
                        <FormattedMessage
                          id='freethedream.done'
                          defaultMessage='Done'
                        />
                      </span>
                    )}
                  </span>
                  <span className='freethedream-row__meta'>
                    {part.owner?.display_name}
                    {' · '}
                    <FormattedMessage
                      id='freethedream.part_counts'
                      defaultMessage='{items, plural, one {# thing} other {# things}}{parts, plural, =0 {} one { · # part} other { · # parts}}'
                      values={{
                        items: part.items_count,
                        parts: part.parts_count,
                      }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {KINDS.map((kind) => {
        const items = byKind(kind);
        if (items.length === 0) return null;
        return (
          <Section
            key={kind}
            title={intl.formatMessage(kindPluralMessages[kind])}
          >
            <ul className='freethedream-rows'>
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  canClaim={member}
                  onClaim={handleClaim}
                />
              ))}
            </ul>
          </Section>
        );
      })}

      {(project.depends_on.length > 0 ||
        project.needed_by.length > 0 ||
        (member && !project.top && dependencyOptions.length > 0)) && (
        <Section title={intl.formatMessage(messages.dependsOn)}>
          {project.depends_on.length > 0 && (
            <ul className='freethedream-links'>
              {project.depends_on.map((d) => (
                <li key={d.id}>
                  <Link to={`/hub/freethedream/p/${d.id}`}>{d.title}</Link>
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
                  <Link to={`/hub/freethedream/p/${d.id}`}>{d.title}</Link>
                </span>
              ))}
            </p>
          )}
        </Section>
      )}

      {project.top && project.members.length > 0 && (
        <Section title={intl.formatMessage(messages.people)}>
          <People accounts={project.members} />
        </Section>
      )}

      {project.requests.length > 0 && (
        <Section title={intl.formatMessage(messages.requests)}>
          <ul className='freethedream-rows'>
            {project.requests.map((a) => (
              <li
                key={a.id}
                className='freethedream-row freethedream-row--static'
              >
                <Person account={a} />
                <span className='freethedream-row__actions'>
                  <button
                    type='button'
                    className='freethedream__button'
                    data-id={a.id}
                    data-answer='accept'
                    onClick={handleAnswer}
                  >
                    {intl.formatMessage(messages.accept)}
                  </button>
                  <button
                    type='button'
                    className='freethedream__link'
                    data-id={a.id}
                    data-answer='decline'
                    onClick={handleAnswer}
                  >
                    {intl.formatMessage(messages.notNow)}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Comments
        subjectType='project'
        subjectId={project.id}
        comments={project.comments}
        canComment={project.can.comment}
      />

      {composer?.type === 'part' && (
        <ProjectComposer
          parent={project}
          onCancel={closeComposer}
          onSaved={handleSaved}
        />
      )}
      {composer?.type === 'edit' && (
        <ProjectComposer
          editing={project}
          onCancel={closeComposer}
          onSaved={handleSaved}
        />
      )}
      {composer?.type === 'item' && (
        <ItemComposer
          kind={composer.kind}
          project={project}
          onCancel={closeComposer}
          onSaved={handleItemSaved}
        />
      )}
      {composer?.type === 'hand_over' && (
        <HandOver
          rootId={project.root.id}
          title={project.title}
          selfId={accountId}
          onHandOver={handleHandOver}
          onCancel={closeComposer}
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
          onCancel={handleRemoveCancel}
        />
      )}
    </div>
  );
};

// One idea, need, job or offer in a project's list.
const ItemRow: React.FC<{
  item: FtdItemRow;
  canClaim: boolean;
  onClaim: (e: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ item, canClaim, onClaim }) => {
  const intl = useIntl();
  const full = (item.claimed ?? 0) >= item.quantity;

  return (
    <li className='freethedream-row freethedream-row--item'>
      <Link
        to={`/hub/freethedream/i/${item.id}`}
        className='freethedream-row__main'
      >
        <span className='freethedream-row__title'>{item.title}</span>
        <span className='freethedream-row__meta'>
          {item.category && intl.formatMessage(categoryMessages[item.category])}
          {item.category && item.owner && ' · '}
          {item.owner?.display_name}
          {item.kind === 'offer' && item.need && (
            <>
              {' · '}
              <FormattedMessage
                id='freethedream.offer_for'
                defaultMessage='for {need}'
                values={{ need: item.need.title }}
              />
            </>
          )}
          {item.kind === 'idea' && item.taken_on && (
            <>
              {' · '}
              <FormattedMessage
                id='freethedream.taken_on'
                defaultMessage='Taken on'
              />
            </>
          )}
        </span>
      </Link>
      {item.kind === 'need' && (
        <span className='freethedream-row__side'>
          <Progress done={item.covered ?? 0} of={item.quantity} />
          {(item.spare ?? 0) > 0 && (
            <span className='freethedream-tag'>
              <FormattedMessage
                id='freethedream.spare'
                defaultMessage='{count} spare'
                values={{ count: item.spare }}
              />
            </span>
          )}
        </span>
      )}
      {item.kind === 'job' && (
        <span className='freethedream-row__side'>
          <Progress done={item.claimed ?? 0} of={item.quantity} />
          {canClaim && (item.claimed_by_me || !full) && (
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
          )}
        </span>
      )}
    </li>
  );
};
