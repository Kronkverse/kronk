// RoomComposer — "New Room", Huddle's composer (the Ж menu's compose
// action, config/korners/huddle.yaml `compose:`). Drawn in the shared
// <ComposeShell> like every korner's composer: a name and a line about the
// Room. No icon: Kronk has no emoji, and every Room's tile wears the Huddle
// glyph (decisions.md, 2026-10-22).
//
// A Krew comes through Konnect like any other record (decisions.md,
// 2026-10-23, "One composer, one Konnect"): arriving from a Krew
// (`?krew=<id>` or `?konnect=krew:<id>`) puts it in the Konnect row, the
// person can add one there, and the Room is linked to each once it exists.
// The link is not a gate: the Room stays open to everyone. Members-only
// Krew Huddles are not built (docs/spaces/huddle.md).

import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestPost } from 'mastodon/api';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import {
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

export interface CreatedRoom {
  id: string;
}

// What a Room draft keeps (docs/design.md, Drafts).
interface RoomDraftParams {
  name?: string;
  description?: string;
  konnections?: KonnectTarget[];
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
  create: { id: 'huddle.composer.create', defaultMessage: 'Create' },
  creating: { id: 'huddle.composer.creating', defaultMessage: 'Creating…' },
  error: {
    id: 'huddle.composer.error',
    defaultMessage: 'Could not create the Room. Try again?',
  },
});

interface Props {
  // Arriving from a Krew's page: the draft is that Krew's (the Krew itself
  // comes through Konnect, from the same `?krew=`).
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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the new Room will be Konnected to (decisions.md, 2026-10-23).
  const konnect = useKonnect('huddle');
  const restoreKonnect = konnect.restore;
  const commitKonnect = konnect.commit;

  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<RoomDraftParams> | null) => {
      const p = d?.params ?? {};
      setName(p.name ?? '');
      setDescription(p.description ?? '');
      restoreKonnect(p.konnections);
      setError(null);
    },
    [restoreKonnect],
  );

  const draft = useDraft<RoomDraftParams>({
    korner: 'huddle',
    kind: 'room',
    context: forKrewId ? `krew:${forKrewId}` : null,
    snapshot: {
      params: { name, description, konnections: konnect.saved },
    },
    hasContent: name.trim() !== '' || description.trim() !== '',
    apply: applyDraft,
    describe: (d) => d.params.name,
    paused: busy,
  });
  const finishDraft = draft.finish;

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

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !busy;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    void apiRequestPost<CreatedRoom>('v1/huddle/rooms', {
      name: trimmedName,
      description: description.trim() || undefined,
    })
      .then(async (created) => {
        finishDraft();
        await commitKonnect('huddle', created.id);
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
    commitKonnect,
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
      konnect={konnect}
    >
      <ComposeTitle
        value={name}
        onChange={handleNameChange}
        placeholder={intl.formatMessage(messages.name)}
        aria-label={intl.formatMessage(messages.name)}
        maxLength={NAME_MAX}
        disabled={busy}
      />

      <ComposeField
        label={intl.formatMessage(messages.description)}
        hint={intl.formatMessage(messages.descriptionHint)}
      >
        <ComposeInput
          value={description}
          onChange={handleDescriptionChange}
          maxLength={DESCRIPTION_MAX}
          disabled={busy}
        />
      </ComposeField>

      {error && <ComposeHint error>{error}</ComposeHint>}
    </ComposeShell>
  );
};
