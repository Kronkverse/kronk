import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateMapPlace } from 'mastodon/api/map_places';
import type { ApiMapPlaceJSON } from 'mastodon/api/map_places';
import {
  ComposeField,
  ComposeHint,
  ComposeInput,
} from 'mastodon/components/compose_fields';
import { KornerPill } from 'mastodon/components/korner_pill';
import { MapPinPicker } from 'mastodon/components/map_pin_picker';
import type { PinnedLocation } from 'mastodon/components/map_pin_picker';

// "New place", inside the Konnect picker of a composer (decisions.md,
// 2026-10-23, "Location fields become Konnect → Map"). Composers have no
// location fields: where a thing is, is a Konnection to a Map Place. The
// person is mid-compose, so instead of opening Map's Place composer (which
// would leave theirs), the picker makes the Place here: a name, an address
// if they like, and a pin from the shared <MapPinPicker>. The Place is made
// at once (it has to exist to be picked) and handed back as the pick; the
// link to the new record is made when the composer posts. Without a pin the
// server looks the address up, as Map's own Place composer does.

const messages = defineMessages({
  name: { id: 'attachment_picker.new_place.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'attachment_picker.new_place.name_placeholder',
    defaultMessage: 'Fitzroy Gardens',
  },
  address: {
    id: 'attachment_picker.new_place.address',
    defaultMessage: 'Address (optional)',
  },
  addressPlaceholder: {
    id: 'attachment_picker.new_place.address_placeholder',
    defaultMessage: 'Street, suburb, town',
  },
  pin: {
    id: 'attachment_picker.new_place.pin',
    defaultMessage: 'Pin on the map',
  },
  movePin: {
    id: 'attachment_picker.new_place.move_pin',
    defaultMessage: 'Move pin',
  },
  clearPin: {
    id: 'attachment_picker.new_place.clear_pin',
    defaultMessage: 'Clear pin',
  },
  pinned: {
    id: 'attachment_picker.new_place.pinned',
    defaultMessage: 'Pinned at {lat}, {lng}',
  },
  needWhere: {
    id: 'attachment_picker.new_place.need_where',
    defaultMessage: 'Give an address or pin it on the map.',
  },
  add: { id: 'attachment_picker.new_place.add', defaultMessage: 'Add place' },
  adding: {
    id: 'attachment_picker.new_place.adding',
    defaultMessage: 'Adding…',
  },
  back: { id: 'attachment_picker.new_place.back', defaultMessage: 'Back' },
  failed: {
    id: 'attachment_picker.new_place.failed',
    defaultMessage: "Couldn't add that place: {error}",
  },
});

const errorText = (err: unknown): string => {
  const data = (err as { response?: { data?: { error?: unknown } } }).response
    ?.data;
  return typeof data?.error === 'string' ? data.error : '';
};

interface Props {
  onMade: (place: ApiMapPlaceJSON) => void;
  onBack: () => void;
  // The pin picker is open: the Konnect picker leaves Escape to it.
  onPinning: (open: boolean) => void;
  // Saving: the Konnect picker holds still.
  onBusy: (busy: boolean) => void;
}

export const KonnectNewPlace: React.FC<Props> = ({
  onMade,
  onBack,
  onPinning,
  onBusy,
}) => {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<PinnedLocation | null>(null);
  const [pinning, setPinning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);
  useEffect(() => {
    onPinning(pinning);
  }, [pinning, onPinning]);
  useEffect(() => {
    onBusy(saving);
  }, [saving, onBusy]);

  const onName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.currentTarget.value);
  }, []);
  const onAddress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.currentTarget.value);
  }, []);
  const openPin = useCallback(() => {
    setPinning(true);
  }, []);
  const closePin = useCallback(() => {
    setPinning(false);
  }, []);
  const clearPin = useCallback(() => {
    setPin(null);
  }, []);
  // A search result brings its address (and a name, if there isn't one).
  const handlePin = useCallback((pinned: PinnedLocation) => {
    setPin(pinned);
    setPinning(false);
    const label = pinned.label;
    if (label) {
      setAddress((current) => (current.trim() ? current : label));
      setName((current) =>
        current.trim() ? current : (label.split(',')[0] ?? '').trim(),
      );
    }
  }, []);

  const hasName = name.trim() !== '';
  const hasWhere = pin !== null || address.trim() !== '';
  const canAdd = hasName && hasWhere && !saving;

  const add = useCallback(() => {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    void apiCreateMapPlace({
      name: name.trim(),
      address: address.trim() || null,
      ...(pin ? { latitude: pin.lat, longitude: pin.lng } : {}),
    })
      .then((place) => {
        setSaving(false);
        onMade(place);
      })
      .catch((err: unknown) => {
        setError(
          intl.formatMessage(messages.failed, { error: errorText(err) }),
        );
        setSaving(false);
      });
  }, [canAdd, name, address, pin, onMade, intl]);

  // No <form>: the picker is portalled out of a composer's form, and a
  // submit would still reach that form through React.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      add();
    },
    [add],
  );

  return (
    <div className='konnect-new-place'>
      <ComposeField label={intl.formatMessage(messages.name)}>
        <ComposeInput
          ref={nameRef}
          value={name}
          onChange={onName}
          onKeyDown={handleKeyDown}
          placeholder={intl.formatMessage(messages.namePlaceholder)}
          maxLength={120}
          disabled={saving}
          required
        />
      </ComposeField>

      <ComposeField label={intl.formatMessage(messages.address)}>
        <ComposeInput
          value={address}
          onChange={onAddress}
          onKeyDown={handleKeyDown}
          placeholder={intl.formatMessage(messages.addressPlaceholder)}
          maxLength={500}
          disabled={saving}
        />
      </ComposeField>

      <div className='konnect-new-place__pin'>
        <KornerPill
          label={intl.formatMessage(pin ? messages.movePin : messages.pin)}
          onClick={openPin}
          disabled={saving}
        />
        {pin && (
          <>
            <KornerPill
              label={intl.formatMessage(messages.clearPin)}
              onClick={clearPin}
              disabled={saving}
            />
            <ComposeHint>
              {intl.formatMessage(messages.pinned, {
                lat: pin.lat.toFixed(4),
                lng: pin.lng.toFixed(4),
              })}
            </ComposeHint>
          </>
        )}
      </div>

      {hasName && !hasWhere && (
        <ComposeHint>{intl.formatMessage(messages.needWhere)}</ComposeHint>
      )}
      {error && <ComposeHint error>{error}</ComposeHint>}

      <div className='konnect-new-place__actions'>
        <KornerPill
          label={intl.formatMessage(messages.back)}
          onClick={onBack}
          disabled={saving}
        />
        <KornerPill
          variant='primary'
          label={intl.formatMessage(saving ? messages.adding : messages.add)}
          onClick={add}
          disabled={!canAdd}
        />
      </div>

      {pinning && (
        <MapPinPicker
          initial={pin ?? undefined}
          onCancel={closePin}
          onPin={handlePin}
        />
      )}
    </div>
  );
};
