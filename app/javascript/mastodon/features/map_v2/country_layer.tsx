import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import * as maplibregl from 'maplibre-gl';

import countriesUrl from '@/images/first-nations-countries.geojson?url';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { apiGetCountryPeople } from 'mastodon/api/map_country_names';
import type {
  ApiMapCountryPeopleJSON,
  ApiMapCountryPersonJSON,
} from 'mastodon/api/map_country_names';
import { FIRST_NATIONS_COUNTRIES } from 'mastodon/components/first_nations_countries';
import type { FirstNationsCountry } from 'mastodon/components/first_nations_countries';
import { Icon } from 'mastodon/components/icon';
import { useCountryNames } from 'mastodon/hooks/useCountryNames';

// First Nations Country — the Countries of Aboriginal and Torres Strait
// Islander peoples drawn over Australia, always, as part of the map
// (Kommons "Introduce First nation country display", 2026-10-23; drawn as
// shapes you can tap, Kommons "Interactive Map Build", 2026-10-26; always on,
// with no switch, @mangobee, 2026-10-30).
//
// The shapes are traced from @mangobee's own map, shown with their permission
// for education: each Country's colour area was taken off the picture,
// re-projected from its Lambert conformal conic (standard parallels -18° and
// -36°, fitted to 21 towns marked on it) and its name read off the map. Each
// shape carries `name`, `colour` (as on the map), `also` (other names written
// on the same shape), `label` (where its name sits), `bbox` and `area`.
// A shape the reading missed has an empty name, to be named.

interface CountryProps {
  id: number;
  name: string;
  colour: string;
  also?: string[];
  label: [number, number];
  bbox: [number, number, number, number];
  area: number;
}

type CountryCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CountryProps
>;

const SOURCE_ID = 'first-nations-country';
const FILL_ID = 'first-nations-country-fill';
const LINE_ID = 'first-nations-country-line';
const PICKED_ID = 'first-nations-country-picked';

// Under the Mates' fuzz circles and pins, over the basemap.
const BENEATH = 'fuzz-fill';

// The colours stay calm so the names read, and calmer still close in so the
// streets come through; the picked Country lifts.
const FILL_OPACITY: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  ['case', ['boolean', ['feature-state', 'picked'], false], 0.85, 0.62],
  10,
  ['case', ['boolean', ['feature-state', 'picked'], false], 0.55, 0.3],
];

const messages = defineMessages({
  here: {
    id: 'map.country.here',
    defaultMessage: "You're on {name} Country",
  },
  disclaimer: {
    id: 'map.country.disclaimer',
    defaultMessage:
      'Boundaries are approximate. Country, its names and its borders are held by its peoples.',
  },
  find: {
    id: 'map.country.find',
    defaultMessage: 'Find a Country',
  },
  country: {
    id: 'map.country.card_title',
    defaultMessage: '{name} Country',
  },
  unnamed: {
    id: 'map.country.unnamed',
    defaultMessage: 'Not named yet',
  },
  alsoOnMap: {
    id: 'map.country.also_on_map',
    defaultMessage: 'Also written here: {names}',
  },
  alsoKnown: {
    id: 'map.country.also_known',
    defaultMessage: 'Also known as {names}',
  },
  close: { id: 'map.country.close', defaultMessage: 'Close' },
  addName: {
    id: 'map.country.add_name',
    defaultMessage: 'Add another name',
  },
  add: { id: 'map.country.add', defaultMessage: 'Add' },
  addedBy: {
    id: 'map.country.added_by',
    defaultMessage: 'Added by @{acct}',
  },
  removeName: {
    id: 'map.country.remove_name',
    defaultMessage: 'Take {name} off the list',
  },
  addError: {
    id: 'map.country.add_error',
    defaultMessage: "Couldn't add that name. Try again.",
  },
  bornHere: { id: 'map.country.born_here', defaultMessage: 'Born here' },
  livingHere: { id: 'map.country.living_here', defaultMessage: 'Living here' },
  person: { id: 'map.country.person', defaultMessage: '{name} (@{acct})' },
});

// A row of faces on the card: who was born on this Country, or lives on it,
// by their profile (Kommons "map ideas", @mangobee, 2026-10-30). Each opens
// the profile.
const People: React.FC<{
  title: string;
  people: ApiMapCountryPersonJSON[];
}> = ({ title, people }) => {
  const intl = useIntl();
  if (people.length === 0) return null;
  return (
    <div className='map-country__people'>
      <h3 className='map-country__people-title'>{title}</h3>
      <ul className='map-country__people-list'>
        {people.map((p) => (
          <li key={p.id}>
            <Link
              to={`/@${p.acct}`}
              className='map-country__person'
              title={intl.formatMessage(messages.person, {
                name: p.name,
                acct: p.acct,
              })}
            >
              <img src={p.avatar} alt={p.name} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

// "You're on <name> Country" names the Country under the middle of the map
// once it is zoomed in this far; further out the middle is a long way from
// anywhere you'd be looking.
const HERE_FROM_ZOOM = 5;

// Case, accents and ŋ don't matter when matching names.
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ŋ/gi, 'ng')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const listEntry = (name: string): FirstNationsCountry | undefined => {
  const wanted = fold(name);
  if (!wanted) return undefined;
  return FIRST_NATIONS_COUNTRIES.find(
    (c) =>
      fold(c.name) === wanted || (c.also ?? []).some((a) => fold(a) === wanted),
  );
};

// Every name a shape answers to: its own, the others written on it, and the
// other spellings the Country list gives.
const namesOf = (props: CountryProps) => {
  const own = [props.name, ...(props.also ?? [])].filter(Boolean);
  const listed = own.flatMap((n) => {
    const entry = listEntry(n);
    return entry ? [entry.name, ...(entry.also ?? [])] : [];
  });
  return [...new Set([...own, ...listed])];
};

// Roughly how many pixels across a shape is at this zoom (web mercator,
// stretched by latitude), to tell whether its name fits inside.
const widthAt = (props: CountryProps, zoom: number) => {
  const perDegree = (512 * 2 ** zoom) / 360;
  const stretch = 1 / Math.cos((props.label[1] * Math.PI) / 180);
  return Math.sqrt(props.area * stretch) * perDegree;
};

// Names wait until the map is zoomed in a step from where it opens: at
// Australia-wide only Mardu fits, and one name on its own reads as if it
// were picked (@mangobee, 2026-10-26). From zoom 4 a couple of dozen come in
// together, and more as you go closer.
const NAMES_FROM_ZOOM = 4;

const nameFits = (props: CountryProps, zoom: number) =>
  props.name !== '' &&
  zoom >= NAMES_FROM_ZOOM &&
  widthAt(props, zoom) > props.name.length * 7 + 8;

interface Props {
  map: maplibregl.Map | null;
  ready: boolean;
}

export const CountryLayer: React.FC<Props> = ({ map, ready }) => {
  const intl = useIntl();
  const location = useLocation();
  const [here, setHere] = useState<CountryProps | null>(null);
  const [countries, setCountries] = useState<CountryCollection | null>(null);
  const [picked, setPicked] = useState<CountryProps | null>(null);
  const [query, setQuery] = useState('');
  const labelsRef = useRef<Map<number, maplibregl.Marker>>(new Map());

  // The open list: names people have added to a Country, by its shape.
  const { names: openList, add, remove } = useCountryNames();
  const [newName, setNewName] = useState('');
  const [addFailed, setAddFailed] = useState(false);
  const [people, setPeople] = useState<ApiMapCountryPeopleJSON | null>(null);
  const addedByShape = useMemo(() => {
    const byShape = new Map<number, typeof openList>();
    openList.forEach((n) => {
      if (n.shape_id === null) return;
      byShape.set(n.shape_id, [...(byShape.get(n.shape_id) ?? []), n]);
    });
    return byShape;
  }, [openList]);
  const allNames = useCallback(
    (props: CountryProps) => [
      ...namesOf(props),
      ...(addedByShape.get(props.id) ?? []).map((n) => n.name),
    ],
    [addedByShape],
  );
  // A shape's own name, or the first one someone added to it.
  const nameOf = useCallback(
    (props: CountryProps) =>
      props.name || (addedByShape.get(props.id)?.[0]?.name ?? ''),
    [addedByShape],
  );

  // Who was born on or lives on the picked Country, by any name it answers
  // to.
  const pickedNames = useMemo(
    () => (picked ? allNames(picked) : []),
    [picked, allNames],
  );
  useEffect(() => {
    setPeople(null);
    if (pickedNames.length === 0) return;
    let cancelled = false;
    void apiGetCountryPeople(pickedNames)
      .then((data) => {
        if (!cancelled) setPeople(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pickedNames]);

  // A profile's "On <name> Country" links here with ?country=<name>.
  const requested = useMemo(
    () => new URLSearchParams(location.search).get('country'),
    [location.search],
  );

  // The shapes, fetched once the map opens.
  useEffect(() => {
    if (countries) return;
    let cancelled = false;
    void fetch(countriesUrl)
      .then((r) => r.json() as Promise<CountryCollection>)
      .then((data) => {
        if (!cancelled) setCountries(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [countries]);

  // ── Layers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready || !countries) return;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: countries,
        promoteId: 'id',
      });
      const beneath = map.getLayer(BENEATH) ? BENEATH : undefined;
      map.addLayer(
        {
          id: FILL_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': ['get', 'colour'],
            'fill-opacity': FILL_OPACITY,
          },
        },
        beneath,
      );
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#241a42',
            'line-opacity': 0.55,
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 1],
          },
        },
        beneath,
      );
      map.addLayer(
        {
          id: PICKED_ID,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['get', 'id'], -1],
          paint: { 'line-color': '#ffffff', 'line-width': 2.5 },
        },
        beneath,
      );
    }
  }, [map, ready, countries]);

  // ── Names ─────────────────────────────────────────────────────────
  // Drawn in Kronk's own type as small markers, shown only where a name fits
  // inside its Country at this zoom (the basemap carries no label glyphs).
  useEffect(() => {
    if (!map || !ready || !countries) return;
    const labels = labelsRef.current;

    const place = () => {
      const zoom = map.getZoom();
      const view = map.getBounds();
      countries.features.forEach(({ properties: props }) => {
        const show =
          nameFits(props, zoom) &&
          view.contains(props.label as maplibregl.LngLatLike);
        const marker = labels.get(props.id);
        if (show && !marker) {
          const el = document.createElement('span');
          el.className = 'map-country__name';
          el.textContent = props.name;
          labels.set(
            props.id,
            new maplibregl.Marker({ element: el })
              .setLngLat(props.label)
              .addTo(map),
          );
        } else if (!show && marker) {
          marker.remove();
          labels.delete(props.id);
        }
      });
    };

    place();
    map.on('moveend', place);
    return () => {
      map.off('moveend', place);
      labels.forEach((m) => m.remove());
      labels.clear();
    };
  }, [map, ready, countries]);

  // ── You're on ── the Country under the middle of the map ──────────
  useEffect(() => {
    if (!map || !ready || !countries) return;
    const update = () => {
      if (map.getZoom() < HERE_FROM_ZOOM || !map.getLayer(FILL_ID)) {
        setHere(null);
        return;
      }
      const [hit] = map.queryRenderedFeatures(map.project(map.getCenter()), {
        layers: [FILL_ID],
      });
      const id = hit?.properties.id as number | undefined;
      setHere(
        countries.features.find((f) => f.properties.id === id)?.properties ??
          null,
      );
    };
    update();
    map.on('moveend', update);
    // The first frame may not be drawn yet when this runs.
    void map.once('idle', update);
    return () => {
      map.off('moveend', update);
      map.off('idle', update);
    };
  }, [map, ready, countries]);

  // ── Picking ───────────────────────────────────────────────────────
  const pick = useCallback(
    (props: CountryProps | null, fly = false) => {
      setPicked(props);
      if (!map) return;
      if (map.getLayer(PICKED_ID)) {
        map.setFilter(PICKED_ID, ['==', ['get', 'id'], props?.id ?? -1]);
      }
      if (props && fly) {
        const [w, s, e, n] = props.bbox;
        map.fitBounds(
          [
            [w, s],
            [e, n],
          ],
          { padding: 80, maxZoom: 8, duration: 900 },
        );
      }
    },
    [map],
  );

  useEffect(() => {
    if (!map || !ready || !countries) return;
    const previous = picked?.id;
    if (!map.getSource(SOURCE_ID)) return;
    if (previous !== undefined) {
      map.setFeatureState(
        { source: SOURCE_ID, id: previous },
        { picked: true },
      );
    }
    return () => {
      if (previous !== undefined && map.getSource(SOURCE_ID)) {
        map.setFeatureState(
          { source: SOURCE_ID, id: previous },
          { picked: false },
        );
      }
    };
  }, [map, ready, countries, picked]);

  useEffect(() => {
    if (!map || !ready || !countries) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const [hit] = map.queryRenderedFeatures(e.point, { layers: [FILL_ID] });
      const id = hit?.properties.id as number | undefined;
      pick(
        countries.features.find((f) => f.properties.id === id)?.properties ??
          null,
      );
    };
    const pointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const plain = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', onClick);
    map.on('mouseenter', FILL_ID, pointer);
    map.on('mouseleave', FILL_ID, plain);
    return () => {
      map.off('click', onClick);
      map.off('mouseenter', FILL_ID, pointer);
      map.off('mouseleave', FILL_ID, plain);
    };
  }, [map, ready, countries, pick]);

  // ?country=<name> flies there once the shapes are in.
  useEffect(() => {
    if (!requested || !countries || !ready) return;
    const wanted = fold(requested);
    const found = countries.features.find(({ properties }) =>
      allNames(properties).some((n) => fold(n) === wanted),
    );
    if (found) pick(found.properties, true);
  }, [requested, countries, ready, pick, allNames]);

  // ── Find a Country ────────────────────────────────────────────────
  const matches = useMemo(() => {
    const wanted = fold(query);
    if (!wanted || !countries) return [];
    return countries.features
      .map((f) => f.properties)
      .filter((props) => allNames(props).some((n) => fold(n).includes(wanted)))
      .sort(
        (a, b) =>
          Number(!fold(a.name).startsWith(wanted)) -
            Number(!fold(b.name).startsWith(wanted)) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 6);
  }, [query, countries, allNames]);

  const handleQuery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const choose = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = Number(e.currentTarget.value);
      const found = countries?.features.find((f) => f.properties.id === id);
      if (found) pick(found.properties, true);
      setQuery('');
    },
    [countries, pick],
  );

  const close = useCallback(() => {
    pick(null);
  }, [pick]);

  const openHere = useCallback(() => {
    if (here) pick(here);
  }, [here, pick]);

  const handleNewName = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewName(e.target.value);
      setAddFailed(false);
    },
    [],
  );

  const addName = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = newName.trim();
      if (!picked || !name) return;
      void add(name, picked.id)
        .then(() => {
          setNewName('');
          return undefined;
        })
        .catch(() => {
          setAddFailed(true);
        });
    },
    [add, newName, picked],
  );

  const removeName = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      void remove(e.currentTarget.value).catch(() => undefined);
    },
    [remove],
  );

  const entry = picked ? listEntry(picked.name) : undefined;
  const addedNames = picked ? (addedByShape.get(picked.id) ?? []) : [];
  const otherNames = picked
    ? (picked.also ?? []).filter((n) => fold(n) !== fold(picked.name))
    : [];

  const hereName = here ? nameOf(here) : '';

  return (
    <>
      {hereName && here?.id !== picked?.id && (
        <button type='button' className='map-country-here' onClick={openHere}>
          {intl.formatMessage(messages.here, { name: hereName })}
        </button>
      )}
      <div className='map-country'>
        <div className='map-country__find'>
          <input
            type='search'
            value={query}
            onChange={handleQuery}
            placeholder={intl.formatMessage(messages.find)}
            aria-label={intl.formatMessage(messages.find)}
            className='map-country__find-input'
          />
          {matches.length > 0 && (
            <div className='map-country__matches'>
              {matches.map((props) => (
                <button
                  key={props.id}
                  type='button'
                  value={props.id}
                  onClick={choose}
                  className='map-country__match'
                >
                  {props.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {picked && (
          <section className='map-country__card' aria-live='polite'>
            <div className='map-country__card-head'>
              <h2 className='map-country__card-title'>
                {nameOf(picked)
                  ? intl.formatMessage(messages.country, {
                      name: nameOf(picked),
                    })
                  : intl.formatMessage(messages.unnamed)}
              </h2>
              <button
                type='button'
                className='map-country__close'
                onClick={close}
                aria-label={intl.formatMessage(messages.close)}
              >
                <Icon id='close' icon={CloseIcon} />
              </button>
            </div>
            {entry && (
              <p className='map-country__card-line'>
                {[entry.group, entry.region].filter(Boolean).join(' · ')}
              </p>
            )}
            {entry?.also && entry.also.length > 0 && (
              <p className='map-country__card-line'>
                {intl.formatMessage(messages.alsoKnown, {
                  names: entry.also.join(', '),
                })}
              </p>
            )}
            {otherNames.length > 0 && (
              <p className='map-country__card-line'>
                {intl.formatMessage(messages.alsoOnMap, {
                  names: otherNames.join(', '),
                })}
              </p>
            )}
            {addedNames.length > 0 && (
              <ul className='map-country__added'>
                {addedNames.map((n) => (
                  <li
                    key={n.id}
                    className='map-country__added-name'
                    title={
                      n.added_by
                        ? intl.formatMessage(messages.addedBy, {
                            acct: n.added_by.acct,
                          })
                        : undefined
                    }
                  >
                    {n.name}
                    {n.can_remove && (
                      <button
                        type='button'
                        value={n.id}
                        onClick={removeName}
                        className='map-country__added-remove'
                        aria-label={intl.formatMessage(messages.removeName, {
                          name: n.name,
                        })}
                      >
                        <Icon id='close' icon={CloseIcon} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {people && (
              <>
                <People
                  title={intl.formatMessage(messages.bornHere)}
                  people={people.born}
                />
                <People
                  title={intl.formatMessage(messages.livingHere)}
                  people={people.living}
                />
              </>
            )}
            <form className='map-country__add' onSubmit={addName}>
              <input
                type='text'
                value={newName}
                onChange={handleNewName}
                maxLength={60}
                placeholder={intl.formatMessage(messages.addName)}
                aria-label={intl.formatMessage(messages.addName)}
                className='map-country__add-input'
              />
              <button
                type='submit'
                className='map-country__add-button'
                disabled={!newName.trim()}
              >
                {intl.formatMessage(messages.add)}
              </button>
            </form>
            {addFailed && (
              <p className='map-country__card-line' role='alert'>
                {intl.formatMessage(messages.addError)}
              </p>
            )}
            <p className='map-country__card-note'>
              {intl.formatMessage(messages.disclaimer)}
            </p>
          </section>
        )}

        {!picked && (
          <p className='map-country__note'>
            {intl.formatMessage(messages.disclaimer)}
          </p>
        )}
      </div>
    </>
  );
};
