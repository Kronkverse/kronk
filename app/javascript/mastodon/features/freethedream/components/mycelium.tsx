import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiFtdBring,
  apiFtdItemAction,
  apiFtdMycelium,
  apiFtdMyceliumSuggestions,
  apiFtdOfferMycelium,
  apiFtdProjects,
  apiFtdRemoveMycelium,
  apiFtdWithdrawMycelium,
} from 'mastodon/api/freethedream';
import type {
  FtdItemRow,
  FtdMyceliumItem,
  FtdProjectSummary,
} from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';

import { act } from './act';
import { forgetMyMycelium } from './from_my_mycelium';
import { MyceliumComposer } from './mycelium_composer';
import {
  CATEGORIES,
  Loading,
  Section,
  categoryMessages,
  formatAmount,
  itemPath,
  useLoaded,
} from './shared';

// Mycelium (docs/spaces/freethedream.md, Mycelium): what you have, in six
// categories, private to you. Sharing something with an emergence you're
// in offers it there (its On offer), and then shows what it could cover
// in that emergence, one tap to bring it or jump on board.

const messages = defineMessages({
  intro: {
    id: 'freethedream.mycelium.intro',
    defaultMessage:
      'What you have: skills, things, space, time, money, connections. Only you see it. Share something with an emergence you are in and it is on offer there.',
  },
  add: {
    id: 'freethedream.mycelium.add',
    defaultMessage: 'Add to your Mycelium',
  },
  empty: {
    id: 'freethedream.mycelium.empty',
    defaultMessage: 'Nothing here yet.',
  },
  edit: { id: 'freethedream.edit', defaultMessage: 'Edit' },
  remove: { id: 'freethedream.remove', defaultMessage: 'Remove' },
  share: { id: 'freethedream.mycelium.share', defaultMessage: 'Share' },
  done: { id: 'freethedream.mycelium.share_done', defaultMessage: 'Done' },
  shareWith: {
    id: 'freethedream.mycelium.share_with',
    defaultMessage: 'Share with',
  },
  noProjects: {
    id: 'freethedream.mycelium.no_projects',
    defaultMessage: 'Join an emergence to share things with it.',
  },
  removeTitle: {
    id: 'freethedream.mycelium.remove_title',
    defaultMessage: 'Remove {title} from your Mycelium?',
  },
  removeBody: {
    id: 'freethedream.mycelium.remove_body',
    defaultMessage:
      'It comes off On offer wherever you shared it. Anything you said you would bring stays.',
  },
  couldCover: {
    id: 'freethedream.mycelium.could_cover',
    defaultMessage: 'It could cover, in {project}',
  },
  nothingToCover: {
    id: 'freethedream.mycelium.nothing_to_cover',
    defaultMessage:
      'Nothing there it fits yet. It’s on offer for when there is.',
  },
  bringIt: {
    id: 'freethedream.mycelium.bring_it',
    defaultMessage: 'Bring it',
  },
  jumpOn: { id: 'freethedream.jump_on', defaultMessage: 'Jump on board' },
});

export const Mycelium: React.FC = () => {
  const intl = useIntl();
  const {
    data: items,
    failed,
    set,
    reload,
  } = useLoaded('mycelium', () => apiFtdMycelium());
  const [composer, setComposer] = useState<FtdMyceliumItem | 'new' | null>(
    null,
  );
  const [sharing, setSharing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FtdMyceliumItem | null>(null);
  const [projects, setProjects] = useState<FtdProjectSummary[] | null>(null);
  // What the item being shared could cover in the emergence just shared
  // with: { project, rows }.
  const [suggested, setSuggested] = useState<{
    project: FtdProjectSummary;
    rows: FtdItemRow[];
  } | null>(null);

  const replace = useCallback(
    (item: FtdMyceliumItem) => {
      forgetMyMycelium();
      const list = items ?? [];
      set(
        list.some((a) => a.id === item.id)
          ? list.map((a) => (a.id === item.id ? item : a))
          : [...list, item],
      );
    },
    [items, set],
  );

  const openNew = useCallback(() => {
    setComposer('new');
  }, []);
  const close = useCallback(() => {
    setComposer(null);
  }, []);
  const handleSaved = useCallback(
    (item: FtdMyceliumItem) => {
      setComposer(null);
      replace(item);
    },
    [replace],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const item = items?.find((a) => a.id === e.currentTarget.dataset.id);
      if (item) setComposer(item);
    },
    [items],
  );

  const handleShareOpen = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id ?? null;
      setSharing((current) => (current === id ? null : id));
      setSuggested(null);
      if (!projects) void act(apiFtdProjects('mine').then(setProjects));
    },
    [projects],
  );

  const handleShareToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { item, project } = e.target.dataset;
      const summary = projects?.find((p) => p.id === project);
      if (!item || !project || !summary) return;
      if (!e.target.checked) {
        setSuggested(null);
        void act(apiFtdWithdrawMycelium(item, project).then(replace));
        return;
      }
      void act(
        apiFtdOfferMycelium(item, project)
          .then(replace)
          .then(() => apiFtdMyceliumSuggestions(item, project))
          .then((rows) => {
            setSuggested({ project: summary, rows });
          }),
      );
    },
    [projects, replace],
  );

  // One tap on a suggestion: bring it against that need from your
  // Mycelium, or jump on board that Actualise item.
  const handleTake = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const { row, item } = e.currentTarget.dataset;
      const target = suggested?.rows.find((r) => r.id === row);
      const mine = items?.find((a) => a.id === item);
      if (!target || !mine) return;
      const done = () => {
        setSuggested((s) =>
          s ? { ...s, rows: s.rows.filter((r) => r.id !== target.id) } : s,
        );
        reload();
      };
      if (target.kind === 'need') {
        const amount = Math.max(
          1,
          Math.min(mine.quantity, target.left ?? mine.quantity),
        );
        void act(apiFtdBring(target.id, amount, mine.id).then(done));
      } else {
        void act(apiFtdItemAction(target.id, 'claim').then(done));
      }
    },
    [suggested, items, reload],
  );

  const askRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setRemoving(
        items?.find((a) => a.id === e.currentTarget.dataset.id) ?? null,
      );
    },
    [items],
  );
  const cancelRemove = useCallback(() => {
    setRemoving(null);
  }, []);
  const handleRemove = useCallback(() => {
    if (!removing) return;
    const gone = removing.id;
    void act(
      apiFtdRemoveMycelium(gone).then(() => {
        forgetMyMycelium();
        set((items ?? []).filter((a) => a.id !== gone));
        setRemoving(null);
      }),
    );
  }, [removing, items, set]);

  if (!items) return <Loading failed={failed} />;

  const joined = (projects ?? []).filter((p) => p.membership === 'member');

  return (
    <div className='freethedream-column'>
      <p className='freethedream__quiet'>
        {intl.formatMessage(messages.intro)}
      </p>
      <div className='freethedream-actions'>
        <button
          type='button'
          className='freethedream__button'
          onClick={openNew}
        >
          {intl.formatMessage(messages.add)}
        </button>
      </div>

      {items.length === 0 && (
        <p className='freethedream__quiet'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {CATEGORIES.map((category) => {
        const list = items.filter((a) => a.category === category);
        if (list.length === 0) return null;
        return (
          <Section
            key={category}
            title={intl.formatMessage(categoryMessages[category])}
          >
            <ul className='freethedream-rows'>
              {list.map((item) => (
                <li
                  key={item.id}
                  className='freethedream-row freethedream-row--static'
                >
                  <span className='freethedream-row__title'>
                    {item.title}
                    {item.quantity > 1 && (
                      <span className='freethedream-row__count'>
                        ×{item.quantity}
                      </span>
                    )}
                  </span>
                  {item.note && (
                    <span className='freethedream-row__body'>{item.note}</span>
                  )}
                  {item.offered_in.length > 0 && (
                    <span className='freethedream-row__meta'>
                      <FormattedMessage
                        id='freethedream.mycelium.on_offer_in'
                        defaultMessage='On offer in {projects}'
                        values={{
                          projects: item.offered_in
                            .map((o) => o.project.title)
                            .join(', '),
                        }}
                      />
                    </span>
                  )}
                  {item.bringing.length > 0 && (
                    <span className='freethedream-row__meta'>
                      <FormattedMessage
                        id='freethedream.mycelium.bringing'
                        defaultMessage='Bringing it for {needs}'
                        values={{
                          needs: item.bringing
                            .map((b) => `${b.need.title} (${b.project.title})`)
                            .join(', '),
                        }}
                      />
                    </span>
                  )}
                  <span className='freethedream-row__actions'>
                    <button
                      type='button'
                      className='freethedream__link'
                      data-id={item.id}
                      onClick={handleShareOpen}
                    >
                      {intl.formatMessage(
                        sharing === item.id ? messages.done : messages.share,
                      )}
                    </button>
                    <button
                      type='button'
                      className='freethedream__link'
                      data-id={item.id}
                      onClick={handleEdit}
                    >
                      {intl.formatMessage(messages.edit)}
                    </button>
                    <button
                      type='button'
                      className='freethedream__link freethedream__link--danger'
                      data-id={item.id}
                      onClick={askRemove}
                    >
                      {intl.formatMessage(messages.remove)}
                    </button>
                  </span>
                  {sharing === item.id && (
                    <fieldset className='freethedream-share'>
                      <legend className='freethedream-form__label'>
                        {intl.formatMessage(messages.shareWith)}
                      </legend>
                      {projects && joined.length === 0 && (
                        <p className='freethedream__quiet'>
                          {intl.formatMessage(messages.noProjects)}
                        </p>
                      )}
                      {joined.map((p) => (
                        <label key={p.id} className='freethedream-form__choice'>
                          <input
                            type='checkbox'
                            data-item={item.id}
                            data-project={p.id}
                            checked={item.offered_in.some(
                              (o) => o.project.id === p.id,
                            )}
                            onChange={handleShareToggle}
                          />
                          <span>{p.title}</span>
                        </label>
                      ))}
                      {suggested && (
                        <div className='freethedream-share__suggestions'>
                          <p className='freethedream-form__label'>
                            {intl.formatMessage(messages.couldCover, {
                              project: suggested.project.title,
                            })}
                          </p>
                          {suggested.rows.length === 0 ? (
                            <p className='freethedream__quiet'>
                              {intl.formatMessage(messages.nothingToCover)}
                            </p>
                          ) : (
                            <ul className='freethedream-rows'>
                              {suggested.rows.map((row) => (
                                <li
                                  key={row.id}
                                  className='freethedream-row freethedream-row--static'
                                >
                                  <Link
                                    to={itemPath(row)}
                                    className='freethedream-row__title'
                                  >
                                    {row.title}
                                    {row.kind === 'need' && (
                                      <span className='freethedream-row__count'>
                                        {formatAmount(row.quantity, row.unit)}
                                      </span>
                                    )}
                                  </Link>
                                  <span className='freethedream-row__actions'>
                                    <button
                                      type='button'
                                      className='freethedream__button'
                                      data-row={row.id}
                                      data-item={item.id}
                                      onClick={handleTake}
                                    >
                                      {intl.formatMessage(
                                        row.kind === 'need'
                                          ? messages.bringIt
                                          : messages.jumpOn,
                                      )}
                                    </button>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </fieldset>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      {composer && (
        <MyceliumComposer
          editing={composer === 'new' ? undefined : composer}
          onCancel={close}
          onSaved={handleSaved}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={intl.formatMessage(messages.removeTitle, {
            title: removing.title,
          })}
          message={intl.formatMessage(messages.removeBody)}
          confirmLabel={intl.formatMessage(messages.remove)}
          destructive
          onConfirm={handleRemove}
          onCancel={cancelRemove}
        />
      )}
    </div>
  );
};
