import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
  apiFtdAssets,
  apiFtdProjects,
  apiFtdRemoveAsset,
  apiFtdShareAsset,
} from 'mastodon/api/freethedream';
import type {
  FtdAsset,
  FtdProjectSummary,
} from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';

import { AssetComposer } from './asset_composer';
import {
  CATEGORIES,
  Loading,
  Section,
  categoryMessages,
  useLoaded,
} from './shared';

const messages = defineMessages({
  intro: {
    id: 'freethedream.inventory.intro',
    defaultMessage:
      'What you have: skills, things, space, time, money, connections. Only you see it. Share what fits with a project you are in, and its members see it in their audit.',
  },
  add: {
    id: 'freethedream.inventory.add',
    defaultMessage: 'Add to your inventory',
  },
  empty: {
    id: 'freethedream.inventory.empty',
    defaultMessage: 'Nothing here yet.',
  },
  edit: { id: 'freethedream.edit', defaultMessage: 'Edit' },
  remove: { id: 'freethedream.remove', defaultMessage: 'Remove' },
  share: { id: 'freethedream.inventory.share', defaultMessage: 'Share' },
  done: { id: 'freethedream.inventory.share_done', defaultMessage: 'Done' },
  shareWith: {
    id: 'freethedream.inventory.share_with',
    defaultMessage: 'Share with',
  },
  noProjects: {
    id: 'freethedream.inventory.no_projects',
    defaultMessage: 'Join a project to share things with it.',
  },
  removeTitle: {
    id: 'freethedream.inventory.remove_title',
    defaultMessage: 'Remove {title} from your inventory?',
  },
});

export const Inventory: React.FC = () => {
  const intl = useIntl();
  const { data: assets, failed, set } = useLoaded('assets', apiFtdAssets);
  const [composer, setComposer] = useState<FtdAsset | 'new' | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FtdAsset | null>(null);
  const [projects, setProjects] = useState<FtdProjectSummary[] | null>(null);

  const replace = useCallback(
    (asset: FtdAsset) => {
      const list = assets ?? [];
      set(
        list.some((a) => a.id === asset.id)
          ? list.map((a) => (a.id === asset.id ? asset : a))
          : [...list, asset],
      );
    },
    [assets, set],
  );

  const openNew = useCallback(() => {
    setComposer('new');
  }, []);
  const close = useCallback(() => {
    setComposer(null);
  }, []);
  const handleSaved = useCallback(
    (asset: FtdAsset) => {
      setComposer(null);
      replace(asset);
    },
    [replace],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const asset = assets?.find((a) => a.id === e.currentTarget.dataset.id);
      if (asset) setComposer(asset);
    },
    [assets],
  );

  const handleShareOpen = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id ?? null;
      setSharing((current) => (current === id ? null : id));
      if (!projects) void apiFtdProjects('mine').then(setProjects);
    },
    [projects],
  );

  const handleShareToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { asset, project } = e.target.dataset;
      if (!asset || !project) return;
      void apiFtdShareAsset(asset, project, e.target.checked).then(replace);
    },
    [replace],
  );

  const askRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setRemoving(
        assets?.find((a) => a.id === e.currentTarget.dataset.id) ?? null,
      );
    },
    [assets],
  );
  const cancelRemove = useCallback(() => {
    setRemoving(null);
  }, []);
  const handleRemove = useCallback(() => {
    if (!removing) return;
    const gone = removing.id;
    void apiFtdRemoveAsset(gone).then(() => {
      set((assets ?? []).filter((a) => a.id !== gone));
      setRemoving(null);
    });
  }, [removing, assets, set]);

  if (!assets) return <Loading failed={failed} />;

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

      {assets.length === 0 && (
        <p className='freethedream__quiet'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {CATEGORIES.map((category) => {
        const list = assets.filter((a) => a.category === category);
        if (list.length === 0) return null;
        return (
          <Section
            key={category}
            title={intl.formatMessage(categoryMessages[category])}
          >
            <ul className='freethedream-rows'>
              {list.map((asset) => (
                <li
                  key={asset.id}
                  className='freethedream-row freethedream-row--static'
                >
                  <span className='freethedream-row__title'>
                    {asset.title}
                    {asset.quantity > 1 && (
                      <span className='freethedream-row__count'>
                        ×{asset.quantity}
                      </span>
                    )}
                  </span>
                  {asset.note && (
                    <span className='freethedream-row__body'>{asset.note}</span>
                  )}
                  {asset.shared_with.length > 0 && (
                    <span className='freethedream-row__meta'>
                      <FormattedMessage
                        id='freethedream.inventory.shared_with'
                        defaultMessage='Shared with {projects}'
                        values={{
                          projects: asset.shared_with
                            .map((p) => p.title)
                            .join(', '),
                        }}
                      />
                    </span>
                  )}
                  <span className='freethedream-row__actions'>
                    <button
                      type='button'
                      className='freethedream__link'
                      data-id={asset.id}
                      onClick={handleShareOpen}
                    >
                      {intl.formatMessage(
                        sharing === asset.id ? messages.done : messages.share,
                      )}
                    </button>
                    <button
                      type='button'
                      className='freethedream__link'
                      data-id={asset.id}
                      onClick={handleEdit}
                    >
                      {intl.formatMessage(messages.edit)}
                    </button>
                    <button
                      type='button'
                      className='freethedream__link freethedream__link--danger'
                      data-id={asset.id}
                      onClick={askRemove}
                    >
                      {intl.formatMessage(messages.remove)}
                    </button>
                  </span>
                  {sharing === asset.id && (
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
                            data-asset={asset.id}
                            data-project={p.id}
                            checked={asset.shared_with.some(
                              (s) => s.id === p.id,
                            )}
                            onChange={handleShareToggle}
                          />
                          <span>{p.title}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      {composer && (
        <AssetComposer
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
          confirmLabel={intl.formatMessage(messages.remove)}
          destructive
          onConfirm={handleRemove}
          onCancel={cancelRemove}
        />
      )}
    </div>
  );
};
