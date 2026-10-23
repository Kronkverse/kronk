import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateMapPlace } from 'mastodon/api/map_places';
import type { ApiMapPlaceJSON } from 'mastodon/api/map_places';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import {
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerPill } from 'mastodon/components/korner_pill';
import { MapPinPicker } from 'mastodon/components/map_pin_picker';
import type { PinnedLocation } from 'mastodon/components/map_pin_picker';
import { MapPinPreview } from 'mastodon/components/map_pin_preview';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

// Map — the Place composer, /hub/map/places/new. A Place is an exact
// spot with a name and an address (docs/spaces/map.md, Places). Pin it
// with the shared <MapPinPicker> (search an address, or tap the map), or
// give an address alone and the server finds it.
//
// Konnect works as in every composer (useKonnect): opened from a Konnect
// with `?konnect=<slug>:<id>` (the record being Konnected, e.g.
// `kalendar:12`), that record waits in the Konnect row and the new Place is
// linked to it once it's made, so "New place" in the picker ends with the
// event Konnected to it.

const messages = defineMessages({
  label: { id: 'map.place_composer.label', defaultMessage: 'New place' },
  submit: { id: 'map.place_composer.submit', defaultMessage: 'Add place' },
  saving: { id: 'map.place_composer.saving', defaultMessage: 'Adding…' },
  name: { id: 'map.place_composer.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'map.place_composer.name_placeholder',
    defaultMessage: 'Fitzroy Gardens',
  },
  address: { id: 'map.place_composer.address', defaultMessage: 'Address' },
  addressPlaceholder: {
    id: 'map.place_composer.address_placeholder',
    defaultMessage: 'Street, suburb, town',
  },
  pin: { id: 'map.place_composer.pin', defaultMessage: 'Pin it on the map' },
  movePin: { id: 'map.place_composer.move_pin', defaultMessage: 'Move pin' },
  clearPin: {
    id: 'map.place_composer.clear_pin',
    defaultMessage: 'Clear pin',
  },
  hint: {
    id: 'map.place_composer.hint',
    defaultMessage:
      'Whoever can see what you Konnect to a place sees it too. Without a pin, the address is looked up on the map.',
  },
  konnecting: {
    id: 'map.place_composer.konnecting',
    defaultMessage: "It's Konnected to what you came from once it's added.",
  },
  failed: {
    id: 'map.place_composer.failed',
    defaultMessage: "Couldn't add that place: {error}",
  },
});

interface PlaceDraftParams {
  name?: string;
  address?: string;
  pin?: PinnedLocation | null;
  konnections?: KonnectTarget[];
}

interface Props {
  onCancel: () => void;
  onCreated: (place: ApiMapPlaceJSON) => void;
}

const errorText = (err: unknown): string => {
  const data = (err as { response?: { data?: { error?: unknown } } }).response
    ?.data;
  return typeof data?.error === 'string' ? data.error : '';
};

export const PlaceComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();
  // What the new Place will be Konnected to (decisions.md, 2026-10-23).
  const konnect = useKonnect('map');
  const { source, restore: restoreKonnect, commit: commitKonnect } = konnect;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<PinnedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<PlaceDraftParams> | null) => {
      const p = d?.params ?? {};
      setName(p.name ?? '');
      setAddress(p.address ?? '');
      setPin(p.pin ?? null);
      restoreKonnect(p.konnections);
      setError(null);
    },
    [restoreKonnect],
  );

  const draft = useDraft<PlaceDraftParams>({
    korner: 'map',
    kind: 'place',
    // One draft line per record being Konnected (`konnect:kalendar-12`).
    context: source ? `konnect:${source.slug}-${source.id}` : null,
    snapshot: {
      params: { name, address, pin, konnections: konnect.saved },
    },
    hasContent: name.trim() !== '' || address.trim() !== '' || pin !== null,
    apply: applyDraft,
    describe: (d) => d.params.name,
    paused: saving,
  });
  const finishDraft = draft.finish;

  const onName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.currentTarget.value);
  }, []);
  const onAddress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.currentTarget.value);
  }, []);
  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);
  const clearPin = useCallback(() => {
    setPin(null);
  }, []);
  // A pin dropped on a search result brings its address (and a name, if
  // there isn't one yet: the result's first part).
  const handlePin = useCallback((pinned: PinnedLocation) => {
    setPin(pinned);
    setPickerOpen(false);
    const label = pinned.label;
    if (label) {
      setAddress((current) => (current.trim() ? current : label));
      setName((current) =>
        current.trim() ? current : (label.split(',')[0] ?? '').trim(),
      );
    }
  }, []);

  const canSubmit =
    name.trim().length > 0 && (pin !== null || address.trim().length > 0);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    void apiCreateMapPlace({
      name: name.trim(),
      address: address.trim() || null,
      ...(pin ? { latitude: pin.lat, longitude: pin.lng } : {}),
    })
      .then(async (place) => {
        finishDraft();
        // The Place stands even if a link doesn't take (say the record
        // isn't theirs to Konnect); they land on its page.
        await commitKonnect('map', place.id);
        onCreated(place);
      })
      .catch((err: unknown) => {
        setError(
          intl.formatMessage(messages.failed, { error: errorText(err) }),
        );
        setSaving(false);
      });
  }, [
    canSubmit,
    name,
    address,
    pin,
    commitKonnect,
    finishDraft,
    onCreated,
    intl,
  ]);

  return (
    <ComposeShell
      korner='map'
      label={intl.formatMessage(messages.label)}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={saving}
      canSubmit={canSubmit}
      onSubmit={submit}
      onCancel={onCancel}
      draft={draft}
      konnect={konnect}
    >
      <ComposeTitle
        value={name}
        onChange={onName}
        placeholder={intl.formatMessage(messages.namePlaceholder)}
        aria-label={intl.formatMessage(messages.name)}
        maxLength={120}
      />

      <ComposeField label={intl.formatMessage(messages.address)}>
        <ComposeInput
          value={address}
          onChange={onAddress}
          placeholder={intl.formatMessage(messages.addressPlaceholder)}
          maxLength={500}
        />
      </ComposeField>

      {pin && (
        <MapPinPreview
          lng={pin.lng}
          lat={pin.lat}
          zoom={pin.zoom}
          className='place-composer__preview'
        />
      )}

      <div className='place-composer__pin-actions'>
        <KornerPill
          label={intl.formatMessage(pin ? messages.movePin : messages.pin)}
          onClick={openPicker}
        />
        {pin && (
          <KornerPill
            label={intl.formatMessage(messages.clearPin)}
            onClick={clearPin}
          />
        )}
      </div>

      <ComposeHint>
        {intl.formatMessage(messages.hint)}
        {source && <> {intl.formatMessage(messages.konnecting)}</>}
      </ComposeHint>

      {error && <ComposeHint error>{error}</ComposeHint>}

      {pickerOpen && (
        <MapPinPicker
          initial={pin ?? undefined}
          onCancel={closePicker}
          onPin={handlePin}
        />
      )}
    </ComposeShell>
  );
};
