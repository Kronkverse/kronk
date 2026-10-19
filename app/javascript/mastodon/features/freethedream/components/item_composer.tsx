import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiFtdAssets,
  apiFtdCreateItem,
  apiFtdUpdateItem,
} from 'mastodon/api/freethedream';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import type {
  FtdAsset,
  FtdCategory,
  FtdItem,
  FtdItemKind,
  FtdRef,
} from 'mastodon/api_types/freethedream';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { useDraft } from 'mastodon/hooks/useDraft';

import { act } from './act';
import { CATEGORIES, categoryMessages, errorOf } from './shared';

const messages = defineMessages({
  newIdea: { id: 'freethedream.compose.idea', defaultMessage: 'Add an idea' },
  newNeed: {
    id: 'freethedream.compose.bring_title',
    defaultMessage: 'Something to bring',
  },
  newJob: {
    id: 'freethedream.compose.actualise',
    defaultMessage: 'Something to actualise',
  },
  newOffer: {
    id: 'freethedream.compose.offer',
    defaultMessage: 'Offer something',
  },
  bring: {
    id: 'freethedream.compose.bring',
    defaultMessage: 'I can bring this',
  },
  edit: { id: 'freethedream.compose.edit_item', defaultMessage: 'Edit' },
  in: { id: 'freethedream.compose.in', defaultMessage: 'In {title}' },
  add: { id: 'freethedream.compose.add', defaultMessage: 'Add' },
  save: { id: 'freethedream.compose.save', defaultMessage: 'Save' },
  saving: { id: 'freethedream.compose.saving', defaultMessage: 'Saving…' },
  what: { id: 'freethedream.compose.what', defaultMessage: 'What' },
  ideaPlaceholder: {
    id: 'freethedream.compose.idea_placeholder',
    defaultMessage: 'A fire twirler at sunset',
  },
  needPlaceholder: {
    id: 'freethedream.compose.need_placeholder',
    defaultMessage: 'Generator, PA system, $400 for permits',
  },
  jobPlaceholder: {
    id: 'freethedream.compose.actualise_placeholder',
    defaultMessage: 'A spit roast, a fire twirler at sunset',
  },
  offerPlaceholder: {
    id: 'freethedream.compose.offer_placeholder',
    defaultMessage: 'My generator',
  },
  details: {
    id: 'freethedream.compose.details',
    defaultMessage: 'Details (optional)',
  },
  category: {
    id: 'freethedream.compose.category',
    defaultMessage: 'Kind of thing',
  },
  noCategory: {
    id: 'freethedream.compose.no_category',
    defaultMessage: 'Not sure',
  },
  howMany: { id: 'freethedream.compose.how_many', defaultMessage: 'How many' },
  moreWelcome: {
    id: 'freethedream.compose.more_welcome',
    defaultMessage: 'More is welcome',
  },
  moreWelcomeHint: {
    id: 'freethedream.compose.more_welcome_hint',
    defaultMessage:
      'It shows as 20+. Leave it off for things like gas bottles.',
  },
  unit: { id: 'freethedream.compose.unit', defaultMessage: 'Unit (optional)' },
  unitPlaceholder: {
    id: 'freethedream.compose.unit_placeholder',
    defaultMessage: 'kg, bags, $',
  },
  howMuch: {
    id: 'freethedream.compose.how_much',
    defaultMessage: 'How much ($)',
  },
  fromInventory: {
    id: 'freethedream.compose.from_inventory',
    defaultMessage: 'From your inventory (optional)',
  },
  nothing: {
    id: 'freethedream.compose.nothing',
    defaultMessage: 'Nothing chosen',
  },
});

const titleFor = {
  idea: messages.newIdea,
  need: messages.newNeed,
  job: messages.newJob,
  offer: messages.newOffer,
};

const placeholderFor = {
  idea: messages.ideaPlaceholder,
  need: messages.needPlaceholder,
  job: messages.jobPlaceholder,
  offer: messages.offerPlaceholder,
};

// What an item draft keeps (docs/design.md, Drafts), per project or need.
interface ItemDraftParams {
  title?: string;
  body?: string;
  category?: FtdCategory | '';
  quantity?: string;
  unit?: string;
  moreWelcome?: boolean;
  assetId?: string;
}

interface Props {
  kind: FtdItemKind;
  // Where it goes: a project or part, or (for an offer) the need it's for.
  project?: FtdRef;
  need?: FtdRef & { category: FtdCategory | null };
  editing?: FtdItem;
  onCancel: () => void;
  onSaved: (item: FtdItem) => void;
}

export const ItemComposer: React.FC<Props> = ({
  kind,
  project,
  need,
  editing,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [category, setCategory] = useState<FtdCategory | ''>(
    editing?.category ?? need?.category ?? '',
  );
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1));
  const [unit, setUnit] = useState(editing?.unit ?? '');
  const [moreWelcome, setMoreWelcome] = useState(
    editing?.more_welcome ?? false,
  );
  const [assets, setAssets] = useState<FtdAsset[]>([]);
  const [assetId, setAssetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offering = kind === 'offer' && !editing;

  // Drafts: what you've written is saved as you go and comes back when
  // the composer opens again in the same place. Editing doesn't.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<ItemDraftParams> | null) => {
      const p = d?.params ?? {};
      setTitle(p.title ?? '');
      setBody(p.body ?? '');
      setCategory(p.category ?? need?.category ?? '');
      setQuantity(p.quantity ?? '1');
      setUnit(p.unit ?? '');
      setMoreWelcome(p.moreWelcome ?? false);
      setAssetId(p.assetId ?? '');
      setError(null);
    },
    [need?.category],
  );

  const draft = useDraft<ItemDraftParams>({
    korner: 'freethedream',
    kind: 'item',
    context: need
      ? `need:${need.id}`
      : project
        ? `project:${project.id}`
        : null,
    active: !editing,
    snapshot: {
      params: { title, body, category, quantity, unit, moreWelcome, assetId },
    },
    hasContent: title.trim() !== '' || body.trim() !== '',
    apply: applyDraft,
    describe: (d) => d.params.title,
    paused: busy,
  });

  const finishDraft = draft.finish;

  useEffect(() => {
    if (!offering) return;
    void act(apiFtdAssets().then(setAssets));
  }, [offering]);

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleBody = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.target.value);
    },
    [],
  );
  const handleCategory = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setCategory(
        (CATEGORIES as string[]).includes(value) ? (value as FtdCategory) : '',
      );
    },
    [],
  );
  const handleQuantity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuantity(e.target.value);
    },
    [],
  );
  const handleMoreWelcome = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMoreWelcome(e.target.checked);
    },
    [],
  );
  const handleUnit = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUnit(e.target.value);
  }, []);
  const handleAsset = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setAssetId(id);
      const asset = assets.find((a) => a.id === id);
      if (asset) {
        setTitle((prev) => prev || asset.title);
        setCategory(asset.category);
      }
    },
    [assets],
  );

  const amount = Number.parseInt(quantity, 10);
  const canSubmit = title.trim().length > 0 && amount > 0;

  const handleSubmit = useCallback(() => {
    setBusy(true);
    setError(null);
    const params = {
      title: title.trim(),
      body: body.trim(),
      category: category || null,
      quantity: amount,
      unit: kind === 'job' ? '' : unit.trim(),
      ...(kind === 'need' ? { more_welcome: moreWelcome } : {}),
    };
    const request = editing
      ? apiFtdUpdateItem(editing.id, params)
      : apiFtdCreateItem({
          ...params,
          kind,
          project_id: project?.id,
          need_id: need?.id,
          asset_id: assetId || null,
        });
    request
      .then((item) => {
        if (!editing) finishDraft();
        onSaved(item);
      })
      .catch((err: unknown) => {
        setError(errorOf(err));
        setBusy(false);
      });
  }, [
    title,
    body,
    category,
    amount,
    unit,
    moreWelcome,
    editing,
    kind,
    project,
    need,
    assetId,
    finishDraft,
    onSaved,
  ]);

  const label = editing
    ? intl.formatMessage(messages.edit)
    : need
      ? intl.formatMessage(messages.bring)
      : intl.formatMessage(titleFor[kind]);
  const where = need ?? project;

  const quantityLabel =
    category === 'money' ? messages.howMuch : messages.howMany;

  return (
    <ComposeShell
      korner='freethedream'
      label={label}
      subtitle={
        where && !editing
          ? intl.formatMessage(messages.in, { title: where.title })
          : undefined
      }
      submitLabel={intl.formatMessage(editing ? messages.save : messages.add)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      draft={draft}
    >
      <div className='freethedream-form'>
        {offering && assets.length > 0 && (
          <label className='freethedream-form__field'>
            <span className='freethedream-form__label'>
              {intl.formatMessage(messages.fromInventory)}
            </span>
            <select
              className='freethedream__input'
              value={assetId}
              onChange={handleAsset}
            >
              <option value=''>{intl.formatMessage(messages.nothing)}</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className='freethedream-form__field'>
          <span className='freethedream-form__label'>
            {intl.formatMessage(messages.what)}
          </span>
          <input
            className='freethedream__input'
            value={title}
            onChange={handleTitle}
            maxLength={160}
            placeholder={intl.formatMessage(placeholderFor[kind])}
          />
        </label>
        <label className='freethedream-form__field'>
          <span className='freethedream-form__label'>
            {intl.formatMessage(messages.details)}
          </span>
          <textarea
            className='freethedream__input'
            rows={3}
            value={body}
            onChange={handleBody}
            maxLength={5000}
          />
        </label>
        {/* Actualise is open-ended (no headcount), and ideas are gone:
            neither has an amount. */}
        {kind !== 'idea' && kind !== 'job' && (
          <div className='freethedream-form__row'>
            <label className='freethedream-form__field'>
              <span className='freethedream-form__label'>
                {intl.formatMessage(messages.category)}
              </span>
              <select
                className='freethedream__input'
                value={category}
                onChange={handleCategory}
              >
                <option value=''>
                  {intl.formatMessage(messages.noCategory)}
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {intl.formatMessage(categoryMessages[c])}
                  </option>
                ))}
              </select>
            </label>
            <label className='freethedream-form__field'>
              <span className='freethedream-form__label'>
                {intl.formatMessage(quantityLabel)}
              </span>
              <input
                type='number'
                min={1}
                className='freethedream__input'
                value={quantity}
                onChange={handleQuantity}
              />
            </label>
            <label className='freethedream-form__field'>
              <span className='freethedream-form__label'>
                {intl.formatMessage(messages.unit)}
              </span>
              <input
                className='freethedream__input'
                value={unit}
                onChange={handleUnit}
                maxLength={20}
                placeholder={intl.formatMessage(messages.unitPlaceholder)}
              />
            </label>
          </div>
        )}
        {/* More is better at an event for some things, not all (Tal,
            2026-10-19): whoever adds a need says. */}
        {kind === 'need' && (
          <label className='freethedream-form__choice'>
            <input
              type='checkbox'
              checked={moreWelcome}
              onChange={handleMoreWelcome}
            />
            <span>
              {intl.formatMessage(messages.moreWelcome)}
              <span className='freethedream-form__hint'>
                {' '}
                {intl.formatMessage(messages.moreWelcomeHint)}
              </span>
            </span>
          </label>
        )}
        {error && (
          <p className='freethedream__error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </ComposeShell>
  );
};
