import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { CheckBox } from 'mastodon/components/check_box';
import { Icon } from 'mastodon/components/icon';

// What the Map shows (Tal, 2026-11-23: "choose what you see on the map …
// checkboxes with 'Mates, Events'… hidden under a button next to the pin
// button … a settings cog"). One box per layer drawn on the Mates map, all
// on to begin with; each viewer's choice stays in this browser. The First
// Nations Country layer isn't one: it is always on, with no switch
// (@mangobee, 2026-10-30; docs/spaces/map.md).

export type MapLayer = 'mates' | 'live' | 'events' | 'places';
export type MapShow = Record<MapLayer, boolean>;

const LAYERS: MapLayer[] = ['mates', 'live', 'events', 'places'];
const ALL_ON: MapShow = { mates: true, live: true, events: true, places: true };
const STORAGE_KEY = 'kronk.map.show';

const messages = defineMessages({
  button: { id: 'map.show.button', defaultMessage: 'What the map shows' },
  title: { id: 'map.show.title', defaultMessage: 'Show on the map' },
  mates: { id: 'map.show.mates', defaultMessage: 'Mates' },
  live: { id: 'map.show.live', defaultMessage: 'Live locations' },
  events: { id: 'map.show.events', defaultMessage: 'Events' },
  places: { id: 'map.show.places', defaultMessage: 'Places' },
});

const read = (): MapShow => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_ON;
    const saved = JSON.parse(raw) as Partial<Record<string, unknown>>;
    return Object.fromEntries(
      LAYERS.map((layer) => [layer, saved[layer] !== false]),
    ) as MapShow;
  } catch {
    return ALL_ON;
  }
};

const write = (show: MapShow) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(show));
  } catch {
    // Private window or blocked storage: the choice lasts this visit.
  }
};

// The viewer's choice, and a way to turn one layer on or off.
export const useMapShow = () => {
  const [show, setShowState] = useState<MapShow>(read);
  const setLayer = useCallback((layer: MapLayer, on: boolean) => {
    setShowState((was) => {
      if (was[layer] === on) return was;
      const next = { ...was, [layer]: on };
      write(next);
      return next;
    });
  }, []);
  return { show, setLayer };
};

export const MapShowMenu: React.FC<{
  show: MapShow;
  onChange: (layer: MapLayer, on: boolean) => void;
}> = ({ show, onChange }) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value as MapLayer, e.target.checked);
    },
    [onChange],
  );

  // A tap outside, or Escape, closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className='map-show' ref={rootRef}>
      <button
        type='button'
        className='map-location__button'
        onClick={toggle}
        aria-expanded={open}
        aria-label={intl.formatMessage(messages.button)}
        title={intl.formatMessage(messages.button)}
      >
        <Icon id='settings' icon={SettingsIcon} />
      </button>

      {open && (
        <fieldset className='map-location__menu map-show__menu'>
          <legend className='map-show__title'>
            {intl.formatMessage(messages.title)}
          </legend>
          {LAYERS.map((layer) => (
            <CheckBox
              key={layer}
              name='map-show'
              value={layer}
              checked={show[layer]}
              onChange={handleChange}
              label={intl.formatMessage(messages[layer])}
            />
          ))}
        </fieldset>
      )}
    </div>
  );
};
