import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiFtdCreateMycelium,
  apiFtdUpdateMycelium,
} from 'mastodon/api/freethedream';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import type {
  FtdMyceliumItem,
  FtdCategory,
} from 'mastodon/api_types/freethedream';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { useDraft } from 'mastodon/hooks/useDraft';

import { CATEGORIES, categoryMessages, errorOf } from './shared';

const messages = defineMessages({
  add: {
    id: 'freethedream.mycelium.add',
    defaultMessage: 'Add to your Mycelium',
  },
  edit: { id: 'freethedream.mycelium.edit', defaultMessage: 'Edit' },
  subtitle: {
    id: 'freethedream.mycelium.private',
    defaultMessage: 'Only you see this until you share it with an emergence.',
  },
  save: { id: 'freethedream.compose.save', defaultMessage: 'Save' },
  saving: { id: 'freethedream.compose.saving', defaultMessage: 'Saving…' },
  category: {
    id: 'freethedream.compose.category',
    defaultMessage: 'Kind of thing',
  },
  what: { id: 'freethedream.compose.what', defaultMessage: 'What' },
  placeholder: {
    id: 'freethedream.mycelium.placeholder',
    defaultMessage: 'Generator, carpentry, a spare room, Saturdays',
  },
  note: {
    id: 'freethedream.mycelium.note',
    defaultMessage: 'Note (optional)',
  },
  howMany: { id: 'freethedream.compose.how_many', defaultMessage: 'How many' },
  howMuch: {
    id: 'freethedream.compose.how_much',
    defaultMessage: 'How much ($)',
  },
});

// What a Mycelium draft keeps (docs/design.md, Drafts).
interface MyceliumDraftParams {
  category?: FtdCategory;
  title?: string;
  note?: string;
  quantity?: string;
}

interface Props {
  editing?: FtdMyceliumItem;
  onCancel: () => void;
  onSaved: (item: FtdMyceliumItem) => void;
}

export const MyceliumComposer: React.FC<Props> = ({
  editing,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [category, setCategory] = useState<FtdCategory>(
    editing?.category ?? 'things',
  );
  const [title, setTitle] = useState(editing?.title ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drafts: what you've written is saved as you go and comes back when
  // the composer opens again. Editing a thing you already have doesn't.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<MyceliumDraftParams> | null) => {
      const p = d?.params ?? {};
      setCategory(p.category ?? 'things');
      setTitle(p.title ?? '');
      setNote(p.note ?? '');
      setQuantity(p.quantity ?? '1');
      setError(null);
    },
    [],
  );

  const draft = useDraft<MyceliumDraftParams>({
    korner: 'freethedream',
    kind: 'mycelium',
    context: null,
    active: !editing,
    snapshot: { params: { category, title, note, quantity } },
    hasContent: title.trim() !== '' || note.trim() !== '',
    apply: applyDraft,
    describe: (d) => d.params.title,
    paused: busy,
  });

  const finishDraft = draft.finish;

  const handleCategory = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if ((CATEGORIES as string[]).includes(value))
        setCategory(value as FtdCategory);
    },
    [],
  );
  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleNote = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNote(e.target.value);
    },
    [],
  );
  const handleQuantity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuantity(e.target.value);
    },
    [],
  );

  const amount = Number.parseInt(quantity, 10);

  const handleSubmit = useCallback(() => {
    setBusy(true);
    setError(null);
    const params = {
      category,
      title: title.trim(),
      note: note.trim(),
      quantity: amount,
    };
    const request = editing
      ? apiFtdUpdateMycelium(editing.id, params)
      : apiFtdCreateMycelium(params);
    request
      .then((item) => {
        if (!editing) finishDraft();
        onSaved(item);
      })
      .catch((err: unknown) => {
        setError(errorOf(err));
        setBusy(false);
      });
  }, [category, title, note, amount, editing, finishDraft, onSaved]);

  return (
    <ComposeShell
      korner='freethedream'
      label={intl.formatMessage(editing ? messages.edit : messages.add)}
      subtitle={intl.formatMessage(messages.subtitle)}
      submitLabel={intl.formatMessage(messages.save)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={title.trim().length > 0 && amount > 0}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      draft={draft}
    >
      <div className='freethedream-form'>
        <label className='freethedream-form__field'>
          <span className='freethedream-form__label'>
            {intl.formatMessage(messages.category)}
          </span>
          <select
            className='freethedream__input'
            value={category}
            onChange={handleCategory}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {intl.formatMessage(categoryMessages[c])}
              </option>
            ))}
          </select>
        </label>
        <label className='freethedream-form__field'>
          <span className='freethedream-form__label'>
            {intl.formatMessage(messages.what)}
          </span>
          <input
            className='freethedream__input'
            value={title}
            onChange={handleTitle}
            maxLength={160}
            placeholder={intl.formatMessage(messages.placeholder)}
          />
        </label>
        <label className='freethedream-form__field'>
          <span className='freethedream-form__label'>
            {intl.formatMessage(
              category === 'money' ? messages.howMuch : messages.howMany,
            )}
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
            {intl.formatMessage(messages.note)}
          </span>
          <textarea
            className='freethedream__input'
            rows={2}
            value={note}
            onChange={handleNote}
            maxLength={1000}
          />
        </label>
        {error && (
          <p className='freethedream__error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </ComposeShell>
  );
};
