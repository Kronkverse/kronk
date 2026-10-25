import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiSearchAttachmentCandidates } from 'mastodon/api/attachments';
import { apiCreateMapPlace } from 'mastodon/api/map_places';
import {
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
} from 'mastodon/components/compose_fields';
import { KornerPill } from 'mastodon/components/korner_pill';
import { MapPinPicker } from 'mastodon/components/map_pin_picker';
import type {
  PinnedLocation,
  PlacePick,
} from 'mastodon/components/map_pin_picker';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';

// Konnect → Map, inside the Konnect picker of a composer (decisions.md,
// 2026-10-23, "Location fields become Konnect → Map"). Composers have no
// location fields: where a thing is, is a Konnection to a Map Place. The
// person is mid-compose, so picking Map opens the map here, search box
// first: existing Places are listed above the search results and picked
// as they are; otherwise a search result, a tap or "Centre on me" drops
// the pin, and the Place's name and address (filled from a search result,
// typed by hand where OpenStreetMap doesn't know the street) are under the
// map. The Place is made at once (it has to exist to be picked) and handed
// back as the pick; the link to the new record is made when the composer
// posts. Without a pin the server looks the address up, as Map's own
// Place composer does.

const messages = defineMessages({
  name: { id: 'attachment_picker.new_place.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'attachment_picker.new_place.name_placeholder',
    defaultMessage: 'Fitzroy Gardens',
  },
  address: {
    id: 'attachment_picker.new_place.address',
    defaultMessage: 'Address',
  },
  addressPlaceholder: {
    id: 'attachment_picker.new_place.address_placeholder',
    defaultMessage: 'Street, suburb, town',
  },
  pinned: {
    id: 'attachment_picker.new_place.pinned',
    defaultMessage: 'Pinned at {lat}, {lng}',
  },
  needWhere: {
    id: 'attachment_picker.new_place.need_where',
    defaultMessage: 'Give an address or pin it on the map.',
  },
  cancel: {
    id: 'attachment_picker.new_place.cancel',
    defaultMessage: 'Cancel',
  },
  add: { id: 'attachment_picker.new_place.add', defaultMessage: 'Add place' },
  adding: {
    id: 'attachment_picker.new_place.adding',
    defaultMessage: 'Adding…',
  },
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
  onPicked: (target: KonnectTarget) => void;
  onCancel: () => void;
  // Places already chosen, left out of the list.
  exclude: string[];
}

export const KonnectMap: React.FC<Props> = ({
  onPicked,
  onCancel,
  exclude,
}) => {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<PinnedLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What a search result last filled in: a newer result replaces it, but
  // never what the person typed.
  const filled = useRef({ name: '', address: '' });

  const excludeKey = exclude.join(' ');
  const searchPlaces = useCallback(
    async (q: string): Promise<PlacePick[]> => {
      const skip = new Set(excludeKey.split(' '));
      const rows = await apiSearchAttachmentCandidates('map', q, 5);
      return rows
        .filter((row) => !skip.has(row.id))
        .map((row) => ({
          id: row.id,
          title: row.title ?? row.id,
          subtitle: row.subtitle,
        }));
    },
    [excludeKey],
  );
  const pickPlace = useCallback(
    (place: PlacePick) => {
      onPicked({ slug: 'map', id: place.id, title: place.title });
    },
    [onPicked],
  );

  const handlePin = useCallback((pinned: PinnedLocation) => {
    setPin(pinned);
    const label = pinned.label;
    if (!label) return;
    const short = (label.split(',')[0] ?? '').trim();
    setName((current) =>
      current.trim() && current !== filled.current.name ? current : short,
    );
    setAddress((current) =>
      current.trim() && current !== filled.current.address ? current : label,
    );
    filled.current = { name: short, address: label };
  }, []);

  const onName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.currentTarget.value);
  }, []);
  const onAddress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.currentTarget.value);
  }, []);

  const hasWhere = pin !== null || address.trim() !== '';
  const canAdd = name.trim() !== '' && hasWhere && !saving;

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
        onPicked({ slug: 'map', id: place.id, title: place.name });
      })
      .catch((err: unknown) => {
        setError(
          intl.formatMessage(messages.failed, { error: errorText(err) }),
        );
        setSaving(false);
      });
  }, [canAdd, name, address, pin, onPicked, intl]);

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

  const cancel = useCallback(() => {
    if (!saving) onCancel();
  }, [saving, onCancel]);

  return (
    <MapPinPicker
      onCancel={cancel}
      onPin={handlePin}
      searchPlaces={searchPlaces}
      onPickPlace={pickPlace}
    >
      <ComposeRow>
        <ComposeField label={intl.formatMessage(messages.name)}>
          <ComposeInput
            value={name}
            onChange={onName}
            onKeyDown={handleKeyDown}
            placeholder={intl.formatMessage(messages.namePlaceholder)}
            maxLength={120}
            disabled={saving}
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
      </ComposeRow>
      {error && <ComposeHint error>{error}</ComposeHint>}
      <div className='konnect-map__actions'>
        <div className='konnect-map__note'>
          {pin ? (
            <ComposeHint>
              {intl.formatMessage(messages.pinned, {
                lat: pin.lat.toFixed(4),
                lng: pin.lng.toFixed(4),
              })}
            </ComposeHint>
          ) : (
            !hasWhere && (
              <ComposeHint>
                {intl.formatMessage(messages.needWhere)}
              </ComposeHint>
            )
          )}
        </div>
        <KornerPill
          label={intl.formatMessage(messages.cancel)}
          onClick={cancel}
          disabled={saving}
        />
        <KornerPill
          variant='primary'
          label={intl.formatMessage(saving ? messages.adding : messages.add)}
          onClick={add}
          disabled={!canAdd}
        />
      </div>
    </MapPinPicker>
  );
};
