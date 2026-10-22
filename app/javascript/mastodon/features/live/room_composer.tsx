// RoomComposer — "New Room", Huddle's composer (the Ж menu's compose
// action, config/korners/huddle.yaml `compose:`). Drawn in the shared
// <ComposeShell> like every korner's composer: a name, a line about the
// Room, and optionally a Krew to Konnect it to. No icon: Kronk has no
// emoji, and every Room's tile wears the Huddle glyph (decisions.md,
// 2026-10-22).
//
// The Krew is a link, not a gate. `POST /api/v1/huddle/rooms` with
// `krew_id` makes the Room and Konnects it to that Krew in one request, so
// it shows on the Krew's page; the Room itself stays open to everyone.
// Members-only Krew Huddles are not built (docs/spaces/huddle.md).
//
// Arriving from a Krew (`/hub/huddle/composer?krew=<id>`) picks that Krew
// to start with. Only Krews you're in are offered (useAvailableKrews), and
// only one shown as picked is sent.

import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestPost } from 'mastodon/api';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KrewMultiSelect } from 'mastodon/components/krew_multi_select';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';
import { useDraft } from 'mastodon/hooks/useDraft';

export interface CreatedRoom {
  id: string;
}

// What a Room draft keeps (docs/design.md, Drafts).
interface RoomDraftParams {
  name?: string;
  description?: string;
  krewId?: string | null;
}

const NAME_MAX = 80;
const DESCRIPTION_MAX = 200;

const messages = defineMessages({
  label: { id: 'huddle.composer.label', defaultMessage: 'New Room' },
  subtitle: {
    id: 'huddle.composer.subtitle',
    defaultMessage: 'An open room anyone can drop into.',
  },
  name: { id: 'huddle.composer.name', defaultMessage: 'Room name' },
  description: {
    id: 'huddle.composer.description',
    defaultMessage: 'What is it for?',
  },
  descriptionHint: {
    id: 'huddle.composer.description_hint',
    defaultMessage: 'Optional. One line.',
  },
  krew: { id: 'huddle.composer.krew', defaultMessage: 'Konnect to a Krew' },
  krewHint: {
    id: 'huddle.composer.krew_hint',
    defaultMessage:
      'Optional. The Room shows on the Krew’s page and stays open to everyone.',
  },
  krewChosen: {
    id: 'huddle.composer.krew_chosen',
    defaultMessage:
      'Konnected to {krew}. It shows on their page; anyone can still join.',
  },
  create: { id: 'huddle.composer.create', defaultMessage: 'Create' },
  creating: { id: 'huddle.composer.creating', defaultMessage: 'Creating…' },
  error: {
    id: 'huddle.composer.error',
    defaultMessage: 'Could not create the Room. Try again?',
  },
});

interface Props {
  // Arriving from a Krew's page: Konnect to that Krew to start with.
  forKrewId?: string | null;
  onCancel: () => void;
  onCreated: (room: CreatedRoom) => void;
}

export const RoomComposer: React.FC<Props> = ({
  forKrewId,
  onCancel,
  onCreated,
}) => {
  const intl = useIntl();
  const availableKrews = useAvailableKrews();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [krewId, setKrewId] = useState<string | null>(forKrewId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<RoomDraftParams> | null) => {
      const p = d?.params ?? {};
      setName(p.name ?? '');
      setDescription(p.description ?? '');
      setKrewId(p.krewId ?? forKrewId ?? null);
      setError(null);
    },
    [forKrewId],
  );

  const draft = useDraft<RoomDraftParams>({
    korner: 'huddle',
    kind: 'room',
    context: forKrewId ? `krew:${forKrewId}` : null,
    snapshot: { params: { name, description, krewId } },
    hasContent: name.trim() !== '' || description.trim() !== '',
    apply: applyDraft,
    describe: (d) => d.params.name,
    paused: busy,
  });
  const finishDraft = draft.finish;

  // Only a Krew you're in, and so one shown as picked, is sent.
  const chosenKrew = availableKrews.find((k) => k.id === krewId) ?? null;

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
    },
    [],
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  // One Krew at most: tapping the picked one takes it off.
  const handleToggleKrew = useCallback((id: string) => {
    setKrewId((prev) => (prev === id ? null : id));
  }, []);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !busy;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    void apiRequestPost<CreatedRoom>('v1/huddle/rooms', {
      name: trimmedName,
      description: description.trim() || undefined,
      krew_id: chosenKrew?.id,
    })
      .then((created) => {
        finishDraft();
        onCreated(created);
      })
      .catch(() => {
        setError(intl.formatMessage(messages.error));
        setBusy(false);
      });
  }, [
    canSubmit,
    trimmedName,
    description,
    chosenKrew,
    finishDraft,
    onCreated,
    intl,
  ]);

  return (
    <ComposeShell
      korner='huddle'
      label={intl.formatMessage(messages.label)}
      subtitle={intl.formatMessage(messages.subtitle)}
      submitLabel={intl.formatMessage(messages.create)}
      submittingLabel={intl.formatMessage(messages.creating)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={submit}
      onCancel={onCancel}
      draft={draft}
    >
      <div className='huddle-composer'>
        <label className='huddle-composer__field'>
          <span className='huddle-composer__label'>
            {intl.formatMessage(messages.name)}
          </span>
          <input
            type='text'
            className='huddle-composer__input'
            value={name}
            onChange={handleNameChange}
            maxLength={NAME_MAX}
            disabled={busy}
          />
        </label>

        <label className='huddle-composer__field'>
          <span className='huddle-composer__label'>
            {intl.formatMessage(messages.description)}
          </span>
          <input
            type='text'
            className='huddle-composer__input'
            value={description}
            onChange={handleDescriptionChange}
            maxLength={DESCRIPTION_MAX}
            disabled={busy}
          />
          <span className='huddle-composer__hint'>
            {intl.formatMessage(messages.descriptionHint)}
          </span>
        </label>

        {availableKrews.length > 0 && (
          <div className='huddle-composer__field'>
            <span className='huddle-composer__label'>
              {intl.formatMessage(messages.krew)}
            </span>
            <KrewMultiSelect
              options={availableKrews}
              selectedIds={chosenKrew ? [chosenKrew.id] : []}
              onToggle={handleToggleKrew}
              disabled={busy}
            />
            <span className='huddle-composer__hint'>
              {chosenKrew
                ? intl.formatMessage(messages.krewChosen, {
                    krew: chosenKrew.name,
                  })
                : intl.formatMessage(messages.krewHint)}
            </span>
          </div>
        )}

        {error && (
          <p className='huddle-composer__error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </ComposeShell>
  );
};
